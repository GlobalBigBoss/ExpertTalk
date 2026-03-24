import whisper
import torch
import logging

from app.config import settings

logger = logging.getLogger(__name__)

_model = None


def _is_cuda_compatible() -> bool:
    """Check if the GPU is actually compatible with this PyTorch build."""
    if not torch.cuda.is_available():
        return False
    try:
        cap = torch.cuda.get_device_capability(0)
        # PyTorch cu126 supports sm_50 to sm_90. RTX 5080 (sm_120) is NOT supported.
        # A simple smoke test: try to allocate a small tensor on CUDA.
        t = torch.zeros(1, device="cuda")
        del t
        return True
    except Exception as e:
        logger.warning(f"CUDA available but GPU incompatible: {e}")
        return False


def get_model():
    global _model
    if _model is None:
        device = settings.whisper_device
        if device == "cuda" and not _is_cuda_compatible():
            logger.warning("CUDA not compatible with this GPU, falling back to CPU")
            device = "cpu"
        logger.info(f"Loading Whisper model '{settings.whisper_model}' on {device}")
        _model = whisper.load_model(settings.whisper_model, device=device)
        logger.info("Whisper model loaded")
    return _model


def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio file and return segments with timestamps."""
    model = get_model()
    logger.info(f"Transcribing: {audio_path}")
    result = model.transcribe(
        audio_path,
        verbose=False,
        language=None,  # auto-detect
    )
    return {
        "text": result["text"],
        "language": result.get("language", "unknown"),
        "segments": [
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
            }
            for seg in result.get("segments", [])
        ],
    }
