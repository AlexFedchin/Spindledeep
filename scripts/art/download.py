"""Fetch the image models used by scripts/art/generate.py into scripts/art/.cache/models."""
import os, sys
import truststore; truststore.inject_into_ssl()  # the antivirus intercepts HTTPS
from huggingface_hub import snapshot_download, hf_hub_download
HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, '.cache', 'models')
which = sys.argv[1:] or ['sdxl', 'realvis']
if 'realvis' in which:
    # RealVisXL V5.0, an SDXL fine-tune for photographic, cinematic images (CreativeML Open RAIL++-M)
    snapshot_download('SG161222/RealVisXL_V5.0', local_dir=os.path.join(M, 'realvis'),
                      allow_patterns=['model_index.json', 'scheduler/*', 'tokenizer/*', 'tokenizer_2/*', '*/config.json',
                                      'text_encoder/model.fp16.safetensors', 'text_encoder_2/model.fp16.safetensors',
                                      'unet/diffusion_pytorch_model.fp16.safetensors', 'vae/diffusion_pytorch_model.fp16.safetensors'])
if 'sdxl' in which:
    # Stable Diffusion XL base 1.0, CreativeML Open RAIL++-M
    snapshot_download('stabilityai/stable-diffusion-xl-base-1.0', local_dir=os.path.join(M, 'sdxl'),
                      allow_patterns=['model_index.json', 'scheduler/*', 'tokenizer/*', 'tokenizer_2/*', '*/config.json',
                                      'text_encoder/model.fp16.safetensors', 'text_encoder_2/model.fp16.safetensors',
                                      'unet/diffusion_pytorch_model.fp16.safetensors', 'vae/diffusion_pytorch_model.fp16.safetensors'])
    snapshot_download('madebyollin/sdxl-vae-fp16-fix', local_dir=os.path.join(M, 'sdxl-vae-fix'),
                      allow_patterns=['config.json', 'diffusion_pytorch_model.safetensors'])
print('done', which)
