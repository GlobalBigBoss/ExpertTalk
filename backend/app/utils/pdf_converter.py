"""Convert PPTX to PDF using available system tools.

Priority:
1. PowerPoint COM automation (Windows + Office installed)
2. LibreOffice headless (cross-platform)
"""
import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def convert_pptx_to_pdf(pptx_path: Path) -> Path:
    """Convert a .pptx file to .pdf. Returns the PDF path.

    Raises RuntimeError if no conversion method is available.
    """
    pdf_path = pptx_path.with_suffix(".pdf")

    # Already converted?
    if pdf_path.exists():
        return pdf_path

    # Try PowerPoint COM on Windows
    if sys.platform == "win32":
        try:
            return _convert_with_powerpoint(pptx_path, pdf_path)
        except Exception as e:
            logger.warning(f"PowerPoint COM failed: {e}, trying LibreOffice...")

    # Try LibreOffice headless
    try:
        return _convert_with_libreoffice(pptx_path, pdf_path)
    except Exception as e:
        logger.warning(f"LibreOffice failed: {e}")

    raise RuntimeError(
        "无法将 PPT 转换为 PDF。请安装 Microsoft PowerPoint 或 LibreOffice。"
    )


def _convert_with_powerpoint(pptx_path: Path, pdf_path: Path) -> Path:
    """Use PowerPoint COM automation (Windows only)."""
    import comtypes.client

    powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
    powerpoint.Visible = 1

    try:
        presentation = powerpoint.Presentations.Open(
            str(pptx_path.resolve()), ReadOnly=True, WithWindow=False
        )
        # SaveAs with formatType=32 means PDF
        presentation.SaveAs(str(pdf_path.resolve()), 32)
        presentation.Close()
    finally:
        powerpoint.Quit()

    logger.info(f"PDF generated via PowerPoint: {pdf_path}")
    return pdf_path


def _convert_with_libreoffice(pptx_path: Path, pdf_path: Path) -> Path:
    """Use LibreOffice headless mode."""
    # Try common LibreOffice paths
    lo_paths = []
    if sys.platform == "win32":
        lo_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
    else:
        lo_paths = ["soffice", "libreoffice"]

    for lo_bin in lo_paths:
        try:
            result = subprocess.run(
                [
                    lo_bin,
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", str(pptx_path.parent),
                    str(pptx_path),
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if pdf_path.exists():
                logger.info(f"PDF generated via LibreOffice: {pdf_path}")
                return pdf_path
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            logger.warning("LibreOffice timed out")
            continue

    raise RuntimeError("LibreOffice not found or conversion failed")
