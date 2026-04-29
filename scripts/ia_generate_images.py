#!/usr/bin/env python3
"""
Script 2 : dépile la queue générée par ia_build_queue.py,
appelle le provider IA configuré, sauvegarde les images et met à jour le JSON.

Usage:
    # Une image à la fois (interactif)
    python scripts/ia_generate_images.py queue.json

    # Lot de N images sans confirmation
    python scripts/ia_generate_images.py queue.json --batch 10

    # Tout générer d'un coup
    python scripts/ia_generate_images.py queue.json --batch 0

    # Avec prompt supplémentaire (style, ambiance…)
    python scripts/ia_generate_images.py queue.json --extra-prompt "dark fantasy, oil painting, highly detailed"

    # Changer de provider à la volée
    python scripts/ia_generate_images.py queue.json --provider openai_dalle
"""

import argparse
import configparser
import json
import os
import sys
import time
import urllib.parse
import urllib.request


# ── Chargement de la config ───────────────────────────────────────────────────

def load_config(config_path: str) -> configparser.ConfigParser:
    if not os.path.isfile(config_path):
        print(f"[ERREUR] Config introuvable : {config_path}", file=sys.stderr)
        sys.exit(1)
    cfg = configparser.ConfigParser()
    cfg.read(config_path, encoding="utf-8")
    return cfg


def get_provider(cfg: configparser.ConfigParser, provider_name: str | None) -> tuple[str, configparser.SectionProxy]:
    name = provider_name or cfg.get("default", "active_provider", fallback="pollinations")
    if not cfg.has_section(name):
        available = [s for s in cfg.sections() if s != "default"]
        print(f"[ERREUR] Provider inconnu : '{name}'. Disponibles : {available}", file=sys.stderr)
        sys.exit(1)
    return name, cfg[name]


# ── Backends de téléchargement ────────────────────────────────────────────────

def _http_get_image(url: str, timeout: int) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "adventure-book-ia/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_post_json(url: str, payload: dict, headers: dict, timeout: int) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def download_pollinations(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    encoded = urllib.parse.quote(prompt, safe="")
    url = provider["url_template"].format(
        prompt=encoded,
        width=provider.getint("width", 768),
        height=provider.getint("height", 768),
    )
    print(f"  → {url[:100]}…")
    return _http_get_image(url, timeout)


def download_openai_dalle(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    import base64
    api_key = provider.get("api_key", "")
    if not api_key or api_key.startswith("sk-..."):
        raise ValueError("Clé API OpenAI manquante dans ia_config.ini")
    payload = {
        "model":   provider.get("model", "dall-e-3"),
        "prompt":  prompt,
        "n":       1,
        "size":    f"{provider.getint('width', 1024)}x{provider.getint('height', 1024)}",
        "quality": provider.get("quality", "standard"),
        "response_format": "b64_json",
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    print(f"  → OpenAI DALL-E ({payload['model']})…")
    result = _http_post_json("https://api.openai.com/v1/images/generations", payload, headers, timeout)
    b64 = result["data"][0]["b64_json"]
    return base64.b64decode(b64)


def download_stability(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    import base64
    api_key = provider.get("api_key", "")
    if not api_key or api_key.startswith("sk-..."):
        raise ValueError("Clé API Stability AI manquante dans ia_config.ini")
    model = provider.get("model", "stable-diffusion-xl-1024-v1-0")
    url = f"https://api.stability.ai/v1/generation/{model}/text-to-image"
    payload = {
        "text_prompts": [{"text": prompt, "weight": 1}],
        "width":  provider.getint("width", 1024),
        "height": provider.getint("height", 1024),
        "steps":  provider.getint("steps", 30),
    }
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    print(f"  → Stability AI ({model})…")
    result = _http_post_json(url, payload, headers, timeout)
    b64 = result["artifacts"][0]["base64"]
    return base64.b64decode(b64)


def download_automatic1111(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    import base64
    base_url = provider.get("base_url", "http://127.0.0.1:7860").rstrip("/")
    payload = {
        "prompt":    prompt,
        "width":     provider.getint("width", 512),
        "height":    provider.getint("height", 512),
        "steps":     provider.getint("steps", 20),
        "cfg_scale": provider.getfloat("cfg_scale", 7),
    }
    print(f"  → Automatic1111 ({base_url})…")
    result = _http_post_json(f"{base_url}/sdapi/v1/txt2img", payload, {}, timeout)
    b64 = result["images"][0]
    return base64.b64decode(b64)


def download_comfyui(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    import base64, uuid
    base_url = provider.get("base_url", "http://127.0.0.1:8188").rstrip("/")
    client_id = str(uuid.uuid4())
    workflow = {
        "3": {"class_type": "KSampler",       "inputs": {"seed": 0, "steps": provider.getint("steps", 20), "cfg": 7, "sampler_name": "euler", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": provider.get("model", "v1-5-pruned-emaonly.safetensors")}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": provider.getint("width", 512), "height": provider.getint("height", 512), "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode",      "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage",      "inputs": {"filename_prefix": "ia_gen", "images": ["8", 0]}},
    }
    print(f"  → ComfyUI ({base_url})…")
    resp = _http_post_json(f"{base_url}/prompt", {"prompt": workflow, "client_id": client_id}, {}, timeout)
    prompt_id = resp["prompt_id"]
    for _ in range(60):
        time.sleep(2)
        hist = _http_post_json(f"{base_url}/history/{prompt_id}", {}, {}, timeout)  # type: ignore
        if prompt_id in hist:
            outputs = hist[prompt_id]["outputs"]
            for node_out in outputs.values():
                if "images" in node_out:
                    img_info = node_out["images"][0]
                    img_url = f"{base_url}/view?filename={img_info['filename']}&subfolder={img_info.get('subfolder','')}&type={img_info.get('type','output')}"
                    return _http_get_image(img_url, timeout)
    raise TimeoutError("ComfyUI n'a pas retourné d'image dans le délai imparti.")


BACKENDS = {
    "url_template":  download_pollinations,
    "openai":        download_openai_dalle,
    "stability":     download_stability,
    "automatic1111": download_automatic1111,
    "comfyui":       download_comfyui,
}


def download_image(prompt: str, provider: configparser.SectionProxy, timeout: int) -> bytes:
    ptype = provider.get("type", "url_template")
    backend = BACKENDS.get(ptype)
    if not backend:
        raise ValueError(f"Type de provider inconnu : '{ptype}'")
    return backend(prompt, provider, timeout)


# ── Mise à jour du JSON ───────────────────────────────────────────────────────

def update_adventure_json(adventure_path: str, task: dict) -> None:
    with open(adventure_path, encoding="utf-8") as f:
        adventure = json.load(f)

    kind     = task["type"]
    filename = task["filename"]

    if kind == "section":
        for section in adventure.get("sections", []):
            if section.get("numero") == task["numero"]:
                section["image"] = filename
                break
    elif kind == "victoire":
        imgs: list = adventure.setdefault("images_victoire", [])
        if filename not in imgs:
            imgs.append(filename)
    elif kind == "defaite":
        imgs = adventure.setdefault("images_defaite", [])
        if filename not in imgs:
            imgs.append(filename)
    # "finish" : juste déposé dans le dossier, pas de champ JSON dédié

    with open(adventure_path, "w", encoding="utf-8") as f:
        json.dump(adventure, f, ensure_ascii=False, indent=4)
    print(f"  ✓ JSON mis à jour")


# ── Traitement d'une tâche ────────────────────────────────────────────────────

def process_task(task: dict, adventure_path: str, images_dir: str,
                 provider: configparser.SectionProxy, extra_prompt: str, timeout: int) -> bool:
    filename = task["filename"]
    dest_path = os.path.join(images_dir, filename)

    if os.path.isfile(dest_path):
        print(f"  ⏭  Déjà présent, ignoré : {filename}")
        return True

    prompt = task["prompt"]
    if extra_prompt:
        prompt = f"{prompt}. {extra_prompt}"

    label = f"section {task['numero']}" if task["type"] == "section" else task["type"]
    print(f"\n[{label}] {filename}")
    print(f"  Prompt : {prompt[:140]}…")

    try:
        data = download_image(prompt, provider, timeout)
        os.makedirs(images_dir, exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(data)
        print(f"  ✓ Sauvegardé ({len(data)//1024} Ko)")
        update_adventure_json(adventure_path, task)
        return True
    except Exception as e:
        print(f"  ✗ Erreur : {e}", file=sys.stderr)
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    script_dir  = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "ia_config.ini")

    parser = argparse.ArgumentParser(
        description="Génère les images IA depuis la queue produite par ia_build_queue.py."
    )
    parser.add_argument(
        "queue",
        help="Chemin vers le fichier images_ia_queue.json"
    )
    parser.add_argument(
        "--batch", type=int, default=1, metavar="N",
        help="Nombre d'images par lot (0=tout, 1=une par une avec confirmation, N=lot de N). Défaut: 1"
    )
    parser.add_argument(
        "--provider", default=None, metavar="NOM",
        help="Provider IA à utiliser (écrase active_provider dans ia_config.ini)"
    )
    parser.add_argument(
        "--extra-prompt", default="", metavar="TEXTE",
        help="Texte ajouté à la fin de chaque prompt (style, ambiance…)"
    )
    args = parser.parse_args()

    cfg = load_config(config_path)
    provider_name, provider = get_provider(cfg, args.provider)
    delay   = cfg.getfloat("default", "delay_between_requests", fallback=2.0)
    timeout = cfg.getint("default", "timeout", fallback=60)

    print(f"[Provider] {provider_name} ({provider.get('type')})")
    if args.extra_prompt:
        print(f"[Extra prompt] {args.extra_prompt}")

    if not os.path.isfile(args.queue):
        print(f"[ERREUR] Queue introuvable : {args.queue}", file=sys.stderr)
        sys.exit(1)

    with open(args.queue, encoding="utf-8") as f:
        data = json.load(f)

    adventure_path: str = data["adventure_path"]
    tasks: list[dict]   = data["tasks"]

    if not os.path.isfile(adventure_path):
        print(f"[ERREUR] Aventure introuvable : {adventure_path}", file=sys.stderr)
        sys.exit(1)

    with open(adventure_path, encoding="utf-8") as f:
        adventure = json.load(f)

    base_dir   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    images_dir = os.path.join(base_dir, adventure.get("repertoire_images", "").rstrip("/"))

    pending = [t for t in tasks if not os.path.isfile(os.path.join(images_dir, t["filename"]))]

    if not pending:
        print("[OK] Toutes les images sont déjà générées.")
        return

    batch_size = len(pending) if args.batch == 0 else args.batch
    print(f"{len(pending)} image(s) à générer — lot de {batch_size}\n")

    done = 0
    errors = 0
    i = 0

    while i < len(pending):
        chunk = pending[i:i + batch_size]

        if args.batch == 1:
            t = chunk[0]
            label = f"section {t['numero']}" if t["type"] == "section" else t["type"]
            print(f"Prochaine : [{label}] {t['filename']}")
            print(f"  Prompt : {t['prompt'][:120]}…")
            rep = input("  Générer ? [O/n/q] ").strip().lower()
            if rep == "q":
                print("Arrêt demandé.")
                break
            if rep == "n":
                i += 1
                continue

        for j, task in enumerate(chunk):
            ok = process_task(task, adventure_path, images_dir, provider, args.extra_prompt, timeout)
            if ok:
                done += 1
            else:
                errors += 1
            if j < len(chunk) - 1:
                time.sleep(delay)

        i += batch_size

        if args.batch > 1 and i < len(pending):
            remaining = len(pending) - i
            rep = input(f"\n{done} générée(s), {remaining} restante(s). Continuer ? [O/n/q] ").strip().lower()
            if rep in ("n", "q"):
                print("Arrêt demandé.")
                break
            time.sleep(delay)

    print(f"\n[Terminé] {done} image(s) générée(s), {errors} erreur(s).")

    # Réécrire la queue en retirant les tâches terminées
    remaining_tasks = [t for t in tasks if not os.path.isfile(os.path.join(images_dir, t["filename"]))]
    data["tasks"] = remaining_tasks
    data["total"] = len(remaining_tasks)
    with open(args.queue, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[Queue] {len(remaining_tasks)} tâche(s) restante(s) dans {args.queue}")


if __name__ == "__main__":
    main()
