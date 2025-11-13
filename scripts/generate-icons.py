#!/usr/bin/env python3
"""
Generate favicon and PWA icons from SVG source
Requires: pip install pillow cairosvg
"""

import os
from pathlib import Path

try:
    from PIL import Image
    import cairosvg
except ImportError:
    print("❌ Missing dependencies. Install with:")
    print("   pip install pillow cairosvg")
    exit(1)

# Paths
ROOT = Path(__file__).parent.parent
SVG_SOURCE = ROOT / "public" / "favicon.svg"
PUBLIC_DIR = ROOT / "public"
ICONS_DIR = ROOT / "public" / "icons"

# Create directories
ICONS_DIR.mkdir(parents=True, exist_ok=True)

# Icon sizes to generate
SIZES = {
    "favicon.ico": (64, 64),
    "icons/apple-touch-icon.png": (180, 180),
    "icons/icon-192x192.png": (192, 192),
    "icons/icon-512x512.png": (512, 512),
}

print("🎨 Generating favicon and icons from SVG...")

if not SVG_SOURCE.exists():
    print(f"❌ Error: {SVG_SOURCE} not found")
    exit(1)

try:
    # First, render SVG to PNG at largest size
    temp_png = PUBLIC_DIR / "temp_icon.png"
    cairosvg.svg2png(
        url=str(SVG_SOURCE),
        write_to=str(temp_png),
        output_width=512,
        output_height=512
    )
    print(f"✅ Rendered SVG to {temp_png}")
    
    # Generate all sizes from the base PNG
    base_img = Image.open(temp_png)
    
    for filename, (width, height) in SIZES.items():
        output_path = PUBLIC_DIR / filename
        
        # Resize with high-quality resampling
        resized = base_img.resize((width, height), Image.Resampling.LANCZOS)
        
        if filename.endswith(".ico"):
            # ICO format
            resized.save(output_path, "ICO", sizes=[(width, height)])
        else:
            # PNG format
            resized.save(output_path, "PNG", optimize=True)
        
        print(f"✅ Generated {filename} ({width}x{height})")
    
    # Clean up temp file
    temp_png.unlink()
    print(f"✅ Cleaned up temporary files")
    print("\n🎉 All icons generated successfully!")
    print(f"\nGenerated files:")
    for filename in SIZES.keys():
        path = PUBLIC_DIR / filename
        if path.exists():
            size = path.stat().st_size / 1024  # KB
            print(f"   {filename:<35} ({size:.1f} KB)")

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
