#!/usr/bin/env python3
"""
Script de génération d'images IA pour les aventures
Lit directement sections.json et génère les images manquantes

Usage:
    # Générer toutes les images manquantes
    python scripts/ia_generate_images.py adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu

    # Générer une section spécifique
    python scripts/ia_generate_images.py adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu -s 18

    # Régénérer une image existante
    python scripts/ia_generate_images.py adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu -s 18 -f

    # Avec prompt supplémentaire
    python scripts/ia_generate_images.py adventures/Defis_Fantastiques_01_-_Le_Sorcier_de_la_Montagne_de_feu --extra-prompt "dark fantasy, oil painting"
"""

import argparse
import configparser
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO


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


def _http_get_json(url: str, timeout: int) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "adventure-book-ia/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


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


def load_comfyui_workflow(workflow_path: str) -> dict:
    """Charge le workflow ComfyUI depuis un fichier JSON"""
    if not os.path.isfile(workflow_path):
        raise FileNotFoundError(f"Workflow ComfyUI introuvable : {workflow_path}")
    with open(workflow_path, encoding="utf-8") as f:
        return json.load(f)


def build_prompt(section_text: str, extra_prompt: str, workflow_config: dict) -> str:
    """Construit le prompt en utilisant la template du workflow"""
    template = workflow_config.get("prompt_template", "Illustration for gamebook. Scene: {scene}")
    
    # Utiliser le texte complet de la scène
    scene = section_text
    
    # Remplacer {scene} dans la template
    prompt = template.format(scene=scene)
    
    # Ajouter le prompt supplémentaire si fourni
    if extra_prompt:
        prompt = f"{prompt}. {extra_prompt}"
    
    return prompt


def download_comfyui(prompt: str, provider: configparser.SectionProxy, timeout: int, workflow_config: dict | None = None) -> bytes:
    import base64, uuid
    
    if workflow_config is None:
        raise ValueError("workflow_config requis pour ComfyUI")
    
    base_url = workflow_config.get("base_url", "http://127.0.0.1:8188").rstrip("/")
    client_id = str(uuid.uuid4())
    
    # Deep copy du workflow depuis la config
    workflow = json.loads(json.dumps(workflow_config["workflow"]))
    
    # Injecter le prompt dans le nœud CLIPTextEncode positif (node 6)
    workflow["6"]["inputs"]["text"] = prompt
    
    print(f"  → ComfyUI ({base_url})…")
    resp = _http_post_json(f"{base_url}/prompt", {"prompt": workflow, "client_id": client_id}, {}, timeout)
    prompt_id = resp["prompt_id"]
    for _ in range(60):
        time.sleep(2)
        hist = _http_get_json(f"{base_url}/history/{prompt_id}", timeout)
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


def download_image(prompt: str, provider: configparser.SectionProxy, timeout: int, workflow_config: dict | None = None) -> bytes:
    ptype = provider.get("type", "url_template")
    backend = BACKENDS.get(ptype)
    if not backend:
        raise ValueError(f"Type de provider inconnu : '{ptype}'")
    
    # ComfyUI a besoin du workflow_config
    if ptype == "comfyui":
        return backend(prompt, provider, timeout, workflow_config)
    else:
        return backend(prompt, provider, timeout)


def compress_image(image_data: bytes, output_format: str, quality: int) -> bytes:
    """Recompresse l'image selon le format et la qualité spécifiés"""
    try:
        from PIL import Image
    except ImportError:
        print("[AVERTISSEMENT] Pillow non installé, compression ignorée", file=sys.stderr)
        return image_data
    
    try:
        img = Image.open(BytesIO(image_data))
        
        # Convertir en RGB si nécessaire (pour JPEG)
        if img.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = rgb_img
        
        # Recompresser
        output = BytesIO()
        img.save(output, format=output_format.upper(), quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        print(f"[AVERTISSEMENT] Erreur lors de la compression : {e}", file=sys.stderr)
        return image_data


# ── Génération d'images ───────────────────────────────────────────────────────

def generate_section_image(section: dict, adventure_dir: str, images_dir: str,
                          provider: configparser.SectionProxy, extra_prompt: str, timeout: int, 
                          workflow_config: dict | None = None, output_format: str = "jpeg", quality: int = 80) -> bool:
    """Génère l'image pour une section"""
    numero = section.get("numero")
    texte = section.get("texte", "")
    
    # Construire le nom du fichier
    filename = f"ia_section_{numero:03d}.jpeg"
    dest_path = os.path.join(images_dir, filename)
    
    # Construire le prompt
    if workflow_config:
        prompt = build_prompt(texte, extra_prompt, workflow_config)
    else:
        # Fallback si pas de workflow_config (pour les autres providers)
        prompt = f"Illustration for gamebook. Scene: {texte[:200]}"
        if extra_prompt:
            prompt = f"{prompt}. {extra_prompt}"
    
    label = f"section {numero}"
    print(f"\n[{label}] {filename}")
    print(f"  Prompt : {prompt[:140]}…")
    
    try:
        data = download_image(prompt, provider, timeout, workflow_config)
        
        # Post-traitement : compression
        data = compress_image(data, output_format, quality)
        
        os.makedirs(images_dir, exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(data)
        print(f"  ✓ Sauvegardé ({len(data)//1024} Ko)")
        
        # Mettre à jour sections.json
        section["image"] = filename
        return True
    except Exception as e:
        print(f"  ✗ Erreur : {e}", file=sys.stderr)
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    script_dir  = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "ia_config.ini")
    workflow_path = os.path.join(script_dir, "comfyui_workflow.json")

    parser = argparse.ArgumentParser(
        description="Génère les images IA pour une aventure en lisant sections.json"
    )
    parser.add_argument(
        "adventure_dir",
        help="Chemin vers le répertoire de l'aventure"
    )
    parser.add_argument(
        "-s", "--section", type=int, default=None, metavar="NUM",
        help="Générer uniquement la section NUM"
    )
    parser.add_argument(
        "-f", "--force", action="store_true",
        help="Régénérer les images même si elles existent déjà"
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

    # Vérifier que le répertoire existe
    if not os.path.isdir(args.adventure_dir):
        print(f"[ERREUR] Répertoire introuvable : {args.adventure_dir}", file=sys.stderr)
        sys.exit(1)

    # Charger couverture.json pour obtenir repertoire_images
    couverture_path = os.path.join(args.adventure_dir, "couverture.json")
    if not os.path.isfile(couverture_path):
        print(f"[ERREUR] couverture.json introuvable : {couverture_path}", file=sys.stderr)
        sys.exit(1)

    with open(couverture_path, encoding="utf-8") as f:
        couverture = json.load(f)

    # Charger sections.json
    sections_path = os.path.join(args.adventure_dir, "sections.json")
    if not os.path.isfile(sections_path):
        print(f"[ERREUR] sections.json introuvable : {sections_path}", file=sys.stderr)
        sys.exit(1)

    with open(sections_path, encoding="utf-8") as f:
        sections_data = json.load(f)

    # Déterminer le répertoire des images
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_images = couverture.get("repertoire_images", "").rstrip("/")
    if repo_images.startswith("adventures/"):
        images_dir = os.path.join(base_dir, repo_images)
    else:
        images_dir = os.path.join(base_dir, "adventures", repo_images)

    # Charger la config
    cfg = load_config(config_path)
    provider_name, provider = get_provider(cfg, args.provider)
    delay   = cfg.getfloat("default", "delay_between_requests", fallback=2.0)
    timeout = cfg.getint("default", "timeout", fallback=60)
    output_format = cfg.get("default", "output_format", fallback="jpeg")
    jpeg_quality = cfg.getint("default", "jpeg_quality", fallback=80)

    # Charger le workflow ComfyUI si nécessaire
    workflow_config = None
    if provider_name == "comfyui":
        workflow_filename = provider.get("workflow_file", "comfyui_workflow.json")
        workflow_path = os.path.join(script_dir, workflow_filename)
        try:
            workflow_config = load_comfyui_workflow(workflow_path)
        except FileNotFoundError as e:
            print(f"[ERREUR] {e}", file=sys.stderr)
            sys.exit(1)

    print(f"[Provider] {provider_name} ({provider.get('type')})")
    print(f"[Aventure] {args.adventure_dir}")
    print(f"[Images] {images_dir}")
    print(f"[Compression] {output_format} @ {jpeg_quality}%")
    if args.extra_prompt:
        print(f"[Extra prompt] {args.extra_prompt}")

    # Filtrer les sections à générer
    sections = sections_data.get("sections", [])
    if args.section:
        sections = [s for s in sections if s.get("numero") == args.section]
        if not sections:
            print(f"[ERREUR] Section {args.section} introuvable", file=sys.stderr)
            sys.exit(1)

    # Filtrer les sections qui ont besoin d'une image
    to_generate = []
    for section in sections:
        numero = section.get("numero")
        filename = f"ia_section_{numero:03d}.jpeg"
        dest_path = os.path.join(images_dir, filename)
        
        if args.force or not os.path.isfile(dest_path):
            to_generate.append(section)

    if not to_generate:
        print("[OK] Toutes les images sont déjà générées.")
        return

    print(f"\n{len(to_generate)} image(s) à générer\n")

    done = 0
    errors = 0

    for i, section in enumerate(to_generate):
        ok = generate_section_image(section, args.adventure_dir, images_dir, provider, args.extra_prompt, timeout, workflow_config, output_format, jpeg_quality)
        if ok:
            done += 1
        else:
            errors += 1
        
        if i < len(to_generate) - 1:
            time.sleep(delay)

    # Sauvegarder sections.json mis à jour
    with open(sections_path, "w", encoding="utf-8") as f:
        json.dump(sections_data, f, ensure_ascii=False, indent=2)

    print(f"\n[Terminé] {done} image(s) générée(s) dans {images_dir}, {errors} erreur(s).")


if __name__ == "__main__":
    main()
