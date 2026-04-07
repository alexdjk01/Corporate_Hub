import random
import time
import uuid
import requests

from app.core.config import COMFYUI_BASE_URL, COMFYUI_CHECKPOINT

DEFAULT_NEGATIVE_PROMPT = (
    "blurry, low quality, low resolution, distorted, bad anatomy, "
    "extra fingers, cropped, watermark, text"
)


def comfyui_health() -> bool:
    try:
        response = requests.get(f"{COMFYUI_BASE_URL}/system_stats", timeout=2)
        return response.status_code == 200
    except Exception:
        return False


def _normalize_dimension(value: int) -> int:
    value = max(256, min(1536, int(value)))
    remainder = value % 8
    if remainder != 0:
        value -= remainder
    return max(256, value)


def build_txt2img_workflow(
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    seed: int,
    steps: int,
    cfg: float,
    file_prefix: str,
) -> dict:
    width = _normalize_dimension(width)
    height = _normalize_dimension(height)

    return {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": COMFYUI_CHECKPOINT,
            },
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1,
            },
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["4", 1],
            },
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negative_prompt,
                "clip": ["4", 1],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2],
            },
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": file_prefix,
                "images": ["8", 0],
            },
        },
    }


def queue_prompt(workflow: dict) -> str:
    payload = {
        "prompt": workflow,
        "client_id": str(uuid.uuid4()),
    }

    response = requests.post(
        f"{COMFYUI_BASE_URL}/prompt",
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    prompt_id = data.get("prompt_id")

    if not prompt_id:
        raise ValueError("ComfyUI did not return a prompt_id")

    return prompt_id


def get_history(prompt_id: str) -> dict:
    response = requests.get(
        f"{COMFYUI_BASE_URL}/history/{prompt_id}",
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def wait_for_result(prompt_id: str, timeout_seconds: int = 180) -> dict:
    started = time.time()

    while time.time() - started < timeout_seconds:
        history = get_history(prompt_id)
        entry = history.get(prompt_id)

        if entry and entry.get("outputs"):
            return entry

        time.sleep(1.0)

    raise TimeoutError("Timed out while waiting for ComfyUI image generation")


def extract_first_image_info(history_entry: dict) -> dict:
    outputs = history_entry.get("outputs", {})

    for node_output in outputs.values():
        images = node_output.get("images", [])
        if images:
            return images[0]

    raise ValueError("No image found in ComfyUI history output")


def download_image_bytes(filename: str, subfolder: str, folder_type: str) -> bytes:
    response = requests.get(
        f"{COMFYUI_BASE_URL}/view",
        params={
            "filename": filename,
            "subfolder": subfolder,
            "type": folder_type,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.content

def generate_image(
    prompt: str,
    negative_prompt: str | None = None,
    width: int = 1024,
    height: int = 1024,
    steps: int = 30,
    cfg: float = 7.0,
    seed: int | None = None,
 ) -> dict:
    prompt = (prompt or "").strip()
    if not prompt:
        raise ValueError("Prompt is required")

    negative_prompt = (negative_prompt or "").strip() or DEFAULT_NEGATIVE_PROMPT
    width = _normalize_dimension(width)
    height = _normalize_dimension(height)

    if seed is None:
        seed = random.randint(1, 2**31 - 1)

    file_prefix = f"corporate_hub_{uuid.uuid4().hex[:12]}"

    workflow = build_txt2img_workflow(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        seed=seed,
        steps=steps,
        cfg=cfg,
        file_prefix=file_prefix,
    )

    prompt_id = queue_prompt(workflow)
    history_entry = wait_for_result(prompt_id)
    image_info = extract_first_image_info(history_entry)

    image_bytes = download_image_bytes(
        filename=image_info["filename"],
        subfolder=image_info.get("subfolder", ""),
        folder_type=image_info.get("type", "output"),
    )

    return {
        "bytes": image_bytes,
        "width": width,
        "height": height,
        "seed": str(seed),
        "model_name": COMFYUI_CHECKPOINT,
    }