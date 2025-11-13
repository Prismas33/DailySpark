#!/usr/bin/env python3
"""
Simple favicon generator using PIL only
Creates a sparkle-like icon programmatically
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os
from pathlib import Path

# Paths
ROOT = Path(__file__).parent
PUBLIC_DIR = ROOT / "public"
ICONS_DIR = ROOT / "public" / "icons"

# Create directories
ICONS_DIR.mkdir(parents=True, exist_ok=True)

def draw_sparkle_star(size, image=None):
    """Draw a sparkle star on an image"""
    if image is None:
        image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    draw = ImageDraw.Draw(image)
    center = size // 2
    
    # Colors
    main_color = (16, 185, 129)  # Emerald
    gold_color = (251, 191, 36)  # Gold
    white = (255, 255, 255)
    
    # Draw 4-pointed star (main)
    star_radius = int(size * 0.35)
    points = []
    
    # 4-pointed star with longer and shorter points
    for i in range(8):
        angle = (i * 45 - 90) * (math.pi / 180)
        is_main_point = (i % 2 == 0)
        radius = star_radius if is_main_point else int(star_radius * 0.5)
        
        x = center + radius * math.cos(angle)
        y = center + radius * math.sin(angle)
        points.append((x, y))
    
    # Draw main star
    draw.polygon(points, fill=main_color, outline=main_color)
    
    # Draw white highlight in center
    highlight_r = int(size * 0.12)
    draw.ellipse(
        [(center - highlight_r, center - highlight_r),
         (center + highlight_r, center + highlight_r)],
        fill=white
    )
    
    # Draw small sparkle dots around
    sparkle_radius = int(size * 0.25)
    dot_size = int(size * 0.06)
    
    for angle in [45, 135, 225, 315]:
        rad = angle * (math.pi / 180)
        x = center + sparkle_radius * math.cos(rad)
        y = center + sparkle_radius * math.sin(rad)
        
        draw.ellipse(
            [(x - dot_size, y - dot_size),
             (x + dot_size, y + dot_size)],
            fill=gold_color
        )
    
    return image

print("🎨 Generating favicon and icons...")

try:
    # Generate base image
    base_size = 512
    base_image = draw_sparkle_star(base_size)
    
    # Save full size
    base_image.save(PUBLIC_DIR / "icons" / "icon-512x512.png", "PNG")
    print("✅ Generated icons/icon-512x512.png (512x512)")
    
    # Generate other sizes
    sizes = {
        "favicon.ico": 64,
        "icons/icon-192x192.png": 192,
        "icons/apple-touch-icon.png": 180,
    }
    
    for filename, size in sizes.items():
        # Resize
        resized = base_image.resize((size, size), Image.Resampling.LANCZOS)
        
        output_path = PUBLIC_DIR / filename
        
        if filename.endswith(".ico"):
            # ICO with multiple sizes
            resized.save(output_path, "ICO")
        else:
            resized.save(output_path, "PNG")
        
        file_size = output_path.stat().st_size / 1024
        print(f"✅ Generated {filename} ({size}x{size}) - {file_size:.1f} KB")
    
    print("\n🎉 All icons generated successfully!")
    print("\nGenerated files in public/:")
    print("  favicon.ico (64x64)")
    print("  icons/icon-192x192.png (192x192)")
    print("  icons/apple-touch-icon.png (180x180)")
    print("  icons/icon-512x512.png (512x512)")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
