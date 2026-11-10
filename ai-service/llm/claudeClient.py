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


def goiLlm(heThong: str, tinNhan: list[dict], soTokenToiDa: int = 2048, mucNoLuc: str = "low") -> str:
    """Gọi LLM và trả văn bản. tinNhan theo định dạng Messages API [{role, content}]."""
    try:
        phanHoi = _layClient().messages.create(
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
