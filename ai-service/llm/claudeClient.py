"""Bọc Anthropic SDK: một lần gọi Messages API, quy mọi lỗi về LoiLlm để tầng trên trả lời dự phòng."""

import anthropic

from cauHinh import layCauHinh


class LoiLlm(Exception):
    """LLM không trả được câu trả lời dùng được (mất mạng, hết hạn mức, từ chối, thiếu khóa...)."""


_client: anthropic.Anthropic | None = None
_cauHinhClient: tuple[str, float] | None = None


def _layClient() -> anthropic.Anthropic:
    global _client, _cauHinhClient
    cauHinh = layCauHinh()
    if not cauHinh.anthropicApiKey:
        raise LoiLlm("Chưa cấu hình ANTHROPIC_API_KEY")
    khoaCauHinh = (cauHinh.anthropicApiKey, cauHinh.thoiGianChoLlm)
    if _client is None or _cauHinhClient != khoaCauHinh:
        _client = anthropic.Anthropic(api_key=cauHinh.anthropicApiKey, timeout=cauHinh.thoiGianChoLlm, max_retries=0)
        _cauHinhClient = khoaCauHinh
    return _client


def daCauHinhLlm() -> bool:
    return bool(layCauHinh().anthropicApiKey)


def goiLlm(
    heThong: str, tinNhan: list[dict], soTokenToiDa: int = 2048, mucNoLuc: str = "low", thoiGianCho: float | None = None
) -> str:
    """Gọi LLM và trả văn bản. tinNhan theo định dạng Messages API [{role, content}].

    thoiGianCho (giây): rút ngắn thời gian chờ cho riêng lần gọi này (VD theo hạn chót của Express);
    None = LLM_TIMEOUT_GIAY."""
    client = _layClient()
    if thoiGianCho is not None:
        client = client.with_options(timeout=thoiGianCho)
    try:
        phanHoi = client.messages.create(
            model=layCauHinh().moHinhLlm,
            max_tokens=soTokenToiDa,
            system=heThong,
            messages=tinNhan,
            output_config={"effort": mucNoLuc},
        )
    except anthropic.APITimeoutError as loi:
        raise LoiLlm("LLM phản hồi quá thời gian") from loi
    except anthropic.RateLimitError as loi:
        raise LoiLlm("LLM vượt hạn mức gọi") from loi
    except anthropic.APIStatusError as loi:
        raise LoiLlm(f"LLM trả lỗi HTTP {loi.status_code}") from loi
    except anthropic.APIConnectionError as loi:
        raise LoiLlm("Không kết nối được LLM") from loi

    # Haiku không có fallback phía server: bị từ chối thì để tầng trên trả lời dự phòng
    if phanHoi.stop_reason == "refusal":
        raise LoiLlm("LLM từ chối trả lời")
    vanBan = "".join(khoi.text for khoi in phanHoi.content if khoi.type == "text").strip()
    if not vanBan:
        raise LoiLlm("LLM trả nội dung rỗng")
    return vanBan


def goiLlmVoiCongCu(
    heThong: str, tinNhan: list[dict], congCu: list[dict], soTokenToiDa: int = 1024, thoiGianCho: float | None = None
) -> dict | None:
    """Gọi LLM kèm danh sách tool (tool_choice auto). Trả {"ten", "thamSo"} của khối tool_use đầu tiên,
    hoặc None nếu LLM trả lời bằng văn bản (không chọn tool nào). Mọi lỗi quy về LoiLlm như goiLlm."""
    client = _layClient()
    if thoiGianCho is not None:
        client = client.with_options(timeout=thoiGianCho)
    try:
        phanHoi = client.messages.create(
            model=layCauHinh().moHinhLlm,
            max_tokens=soTokenToiDa,
            system=heThong,
            messages=tinNhan,
            tools=congCu,
            tool_choice={"type": "auto"},
        )
    except anthropic.APITimeoutError as loi:
        raise LoiLlm("LLM phản hồi quá thời gian") from loi
    except anthropic.RateLimitError as loi:
        raise LoiLlm("LLM vượt hạn mức gọi") from loi
    except anthropic.APIStatusError as loi:
        raise LoiLlm(f"LLM trả lỗi HTTP {loi.status_code}") from loi
    except anthropic.APIConnectionError as loi:
        raise LoiLlm("Không kết nối được LLM") from loi

    if phanHoi.stop_reason == "refusal":
        raise LoiLlm("LLM từ chối trả lời")
    for khoi in phanHoi.content:
        if khoi.type == "tool_use":
            return {"ten": khoi.name, "thamSo": dict(khoi.input or {})}
    return None
