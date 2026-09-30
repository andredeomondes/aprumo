import secrets
import time
from typing import Protocol

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from aprumo_ai.domain import QA, Analysis, Report, Requirement
from aprumo_ai.observability import METRICS, Metrics
from aprumo_ai.reasoner import ReasonerError

UNAVAILABLE = "O assistente está indisponível agora. Tente novamente em instantes."


class Assessor(Protocol):
    def analyze(self, activity: str) -> Analysis: ...

    def evaluate(self, activity: str, requirements: list[Requirement], answers: list[QA]) -> Report: ...


class AnalyzeRequest(BaseModel):
    activity: str = Field(min_length=10, max_length=2000)


class EvaluateRequest(BaseModel):
    activity: str = Field(min_length=10, max_length=2000)
    requirements: list[Requirement] = Field(min_length=1, max_length=30)
    answers: list[QA] = Field(max_length=12)


def create_app(
    service: Assessor, internal_token: str, requirement_count: int, corpus_date: str, metrics: Metrics = METRICS
) -> FastAPI:
    app = FastAPI(title="Aprumo AI", version="0.1.0")

    @app.middleware("http")
    async def measure(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        route = f"{request.method} {request.url.path}"
        if request.url.path.startswith("/v1/") and request.url.path != "/v1/metrics":
            metrics.observe(route, time.perf_counter() - started)
            metrics.inc("http", route=route, status=str(response.status_code))
        return response

    def require_token(x_internal_token: str = Header(default="")) -> None:
        if not secrets.compare_digest(x_internal_token, internal_token):
            raise HTTPException(status_code=401, detail="Token interno inválido.")

    @app.exception_handler(ReasonerError)
    async def reasoner_failed(_: Request, __: ReasonerError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": UNAVAILABLE})

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "requirements": requirement_count, "corpus_date": corpus_date}

    @app.get("/v1/metrics", dependencies=[Depends(require_token)])
    def read_metrics() -> dict:
        return metrics.snapshot()

    # Rotas síncronas: o SDK síncrono roda no threadpool, sem bloquear o event loop.
    @app.post("/v1/analyze", response_model=Analysis, dependencies=[Depends(require_token)])
    def analyze(body: AnalyzeRequest) -> Analysis:
        return service.analyze(body.activity)

    @app.post("/v1/evaluate", response_model=Report, dependencies=[Depends(require_token)])
    def evaluate(body: EvaluateRequest) -> Report:
        return service.evaluate(body.activity, body.requirements, body.answers)

    return app
