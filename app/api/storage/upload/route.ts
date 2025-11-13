import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebaseServer';
import axios from 'axios';
import sizeOf from 'image-size';

// Media validation configuration (based on official platform APIs)
const PLATFORM_LIMITS = {
  linkedin: {
    image: { maxSize: 10 * 1024 * 1024, aspectRatio: { min: 1, max: 1.91 } }, // 10MB (practical limit)
    video: { maxSize: 200 * 1024 * 1024, aspectRatio: { min: 1/2.4, max: 2.4 }, maxDuration: 600 }
  },
  x: {
    image: { maxSize: 5 * 1024 * 1024, aspectRatio: { min: 1, max: 2 } }, // 5MB PNG official limit
    video: { maxSize: 512 * 1024 * 1024, aspectRatio: { min: 1/3, max: 3 }, maxDuration: 140 } // 512MB official
  },
  facebook: {
    image: { maxSize: 4 * 1024 * 1024, aspectRatio: { min: 4/5, max: 1.91 } },
    video: { maxSize: 1024 * 1024 * 1024, aspectRatio: { min: 9/16, max: 16/9 }, maxDuration: 240 },
    reel: { maxSize: 1024 * 1024 * 1024, aspectRatio: 9/16, tolerance: 0.02, maxDuration: 90, minDuration: 3 }
  },
  instagram: {
    image: { maxSize: 8 * 1024 * 1024, aspectRatio: { min: 4/5, max: 1.91 } },
    video: { maxSize: 100 * 1024 * 1024, aspectRatio: { min: 4/5, max: 16/9 }, maxDuration: 60 },
    reel: { maxSize: 100 * 1024 * 1024, aspectRatio: 9/16, tolerance: 0.02, maxDuration: 90, minDuration: 3 }
  }
};

function validateImageDimensions(buffer: Buffer, fileSize: number, isReel: boolean = false) {
  const warnings: string[] = [];
  let isValid = true;

  try {
    const dimensions = sizeOf(buffer);
    const width = dimensions.width || 0;
    const height = dimensions.height || 0;
    
    if (width === 0 || height === 0) {
      return { isValid: false, warnings: ['Could not read image dimensions'], width, height, aspectRatio: 0 };
    }

    const aspectRatio = width / height;

    // Check LinkedIn limits
    const linkedinLimits = PLATFORM_LIMITS.linkedin.image;
    if (fileSize > linkedinLimits.maxSize) {
      warnings.push(`⚠️ LinkedIn: Image too large (${(fileSize/1024/1024).toFixed(1)}MB, max 10MB)`);
      isValid = false;
    }
    if (aspectRatio < linkedinLimits.aspectRatio.min || aspectRatio > linkedinLimits.aspectRatio.max) {
      warnings.push(`⚠️ LinkedIn: Aspect ratio ${aspectRatio.toFixed(2)} may be cropped (ideal: 1:1 to 1.91:1)`);
    }

    // Check X limits
    const xLimits = PLATFORM_LIMITS.x.image;
    if (fileSize > xLimits.maxSize) {
      warnings.push(`⚠️ X: Image too large (${(fileSize/1024/1024).toFixed(1)}MB, max 5MB)`);
      isValid = false;
    }
    if (aspectRatio < xLimits.aspectRatio.min || aspectRatio > xLimits.aspectRatio.max) {
      warnings.push(`⚠️ X: Aspect ratio ${aspectRatio.toFixed(2)} may be cropped (ideal: 1:1 to 2:1)`);
    }

    if (warnings.length === 0) {
      warnings.push(`✅ Image compatible with all platforms (${width}x${height}, ${aspectRatio.toFixed(2)}:1)`);
    }

    return { isValid, warnings, width, height, aspectRatio };
  } catch (error: any) {
    return { isValid: false, warnings: [`Error validating image: ${error.message}`], width: 0, height: 0, aspectRatio: 0 };
  }
}

function validateVideo(fileSize: number, contentType: string, isReel: boolean = false) {
  const warnings: string[] = [];
  let isValid = true;

  // Check file size limits
  if (fileSize > PLATFORM_LIMITS.x.video.maxSize) {
    warnings.push(`⚠️ Video too large for X (${(fileSize/1024/1024).toFixed(1)}MB, max 512MB)`);
    isValid = false;
  }
  if (fileSize > PLATFORM_LIMITS.linkedin.video.maxSize) {
    warnings.push(`⚠️ Video too large for LinkedIn (${(fileSize/1024/1024).toFixed(1)}MB, max 200MB)`);
    isValid = false;
  }

  if (isReel) {
    warnings.push('🎬 Reel: Ensure video is 9:16 vertical, 3-90 seconds duration');
    if (fileSize > PLATFORM_LIMITS.facebook.reel.maxSize) {
      warnings.push(`⚠️ Reel too large (${(fileSize/1024/1024).toFixed(1)}MB, max 1GB)`);
      isValid = false;
    }
  } else {
    warnings.push('📹 Video: LinkedIn max 10min, X max 2:20min');
  }

  if (!isValid) {
    warnings.push('❌ Video exceeds platform limits');
  }

  return { isValid, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string || 'uploads';
    const postType = formData.get('postType') as string || 'post'; // 'post' or 'reel'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileSize = buffer.length;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isReel = postType === 'reel';

    // Validate media
    let validationResult: { isValid: boolean; warnings: string[]; width?: number; height?: number; aspectRatio?: number };
    
    if (isImage) {
      if (isReel) {
        return NextResponse.json({ 
          error: 'Reels require video content, not images',
          success: false 
        }, { status: 400 });
      }
      validationResult = validateImageDimensions(buffer, fileSize, isReel);
    } else if (isVideo) {
      validationResult = validateVideo(fileSize, file.type, isReel);
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload images (PNG, JPG) or videos (MP4, MOV)',
        success: false 
      }, { status: 400 });
    }

    // If validation failed critically, don't upload
    if (!validationResult.isValid) {
      return NextResponse.json({ 
        error: 'Media validation failed',
        warnings: validationResult.warnings,
        success: false 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const filePath = `${path}/${filename}`;

    // Upload to Firebase Storage
    if (!adminStorage) {
      return NextResponse.json({ error: 'Storage indisponível (Admin não inicializado)' }, { status: 500 });
    }
    const bucket = adminStorage.bucket();
    console.log('🪣 Using bucket:', bucket.name);
    const fileRef = bucket.file(filePath);
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Make file public and get download URL
    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      filename: filename,
      mediaType: isVideo ? 'video' : 'image',
      validation: {
        warnings: validationResult.warnings,
        dimensions: isImage ? {
          width: validationResult.width,
          height: validationResult.height,
          aspectRatio: validationResult.aspectRatio
        } : undefined
      }
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error.message || 'Error uploading file' },
      { status: 500 }
    );
  }
}
