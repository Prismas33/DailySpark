import axios from 'axios';
import sizeOf from 'image-size';

export interface MediaValidationResult {
  isValid: boolean;
  mediaType: 'image' | 'video' | 'unknown';
  width?: number;
  height?: number;
  aspectRatio?: number;
  duration?: number; // For videos, in seconds
  fileSize?: number; // In bytes
  warnings: MediaWarning[];
}

export interface MediaWarning {
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// Platform requirements
const PLATFORM_REQUIREMENTS = {
  linkedin: {
    image: {
      minAspectRatio: 1 / 1, // 1:1
      maxAspectRatio: 1.91 / 1, // 1.91:1
      maxFileSize: 8 * 1024 * 1024, // 8MB
    },
    video: {
      minAspectRatio: 1 / 2.4, // Vertical
      maxAspectRatio: 2.4 / 1, // Horizontal
      maxFileSize: 200 * 1024 * 1024, // 200MB
      minDuration: 3, // seconds
      maxDuration: 600, // 10 minutes
    }
  },
  twitter: {
    image: {
      minAspectRatio: 1 / 1, // 1:1
      maxAspectRatio: 2 / 1, // 2:1
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    video: {
      minAspectRatio: 1 / 3, // Very vertical
      maxAspectRatio: 3 / 1, // Very horizontal
      maxFileSize: 512 * 1024 * 1024, // 512MB
      minDuration: 0.5, // seconds
      maxDuration: 140, // 2:20 minutes
    }
  },
  facebook: {
    image: {
      minAspectRatio: 4 / 5, // 4:5 vertical
      maxAspectRatio: 1.91 / 1, // 1.91:1 horizontal
      maxFileSize: 4 * 1024 * 1024, // 4MB
    },
    video: {
      minAspectRatio: 9 / 16, // Vertical
      maxAspectRatio: 16 / 9, // Horizontal
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      minDuration: 1, // seconds
      maxDuration: 240, // 4 minutes for feed
    },
    reel: {
      aspectRatio: 9 / 16, // 9:16 mandatory
      tolerance: 0.02, // 2% tolerance
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      minDuration: 3, // seconds
      maxDuration: 90, // 90 seconds
    }
  },
  instagram: {
    image: {
      minAspectRatio: 4 / 5, // 4:5 vertical
      maxAspectRatio: 1.91 / 1, // 1.91:1 horizontal
      maxFileSize: 8 * 1024 * 1024, // 8MB
    },
    video: {
      minAspectRatio: 4 / 5, // Vertical
      maxAspectRatio: 16 / 9, // Horizontal
      maxFileSize: 100 * 1024 * 1024, // 100MB
      minDuration: 3, // seconds
      maxDuration: 60, // 1 minute for feed
    },
    reel: {
      aspectRatio: 9 / 16, // 9:16 mandatory
      tolerance: 0.02, // 2% tolerance
      maxFileSize: 100 * 1024 * 1024, // 100MB
      minDuration: 3, // seconds
      maxDuration: 90, // 90 seconds
    }
  }
};

/**
 * Validates media dimensions and aspect ratio for social media platforms
 * @param mediaUrl URL of the media to validate
 * @param platforms Platforms to validate for
 * @param isReel Whether this is a Reel (for Facebook/Instagram)
 * @returns Validation result with warnings
 */
export async function validateMedia(
  mediaUrl: string,
  platforms: string[],
  isReel: boolean = false
): Promise<MediaValidationResult> {
  const result: MediaValidationResult = {
    isValid: true,
    mediaType: 'unknown',
    warnings: []
  };

  try {
    // Download media to analyze
    console.log('[MediaValidator] Downloading media for analysis:', mediaUrl);
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      maxContentLength: 1024 * 1024 * 1024, // 1GB max
      timeout: 30000 // 30 seconds timeout
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || '';
    result.fileSize = buffer.length;

    // Determine media type
    if (contentType.startsWith('image/')) {
      result.mediaType = 'image';
      const dimensions = sizeOf(buffer);
      result.width = dimensions.width;
      result.height = dimensions.height;
      
      if (result.width && result.height) {
        result.aspectRatio = result.width / result.height;
        
        // Validate for each platform
        for (const platform of platforms) {
          validateImageForPlatform(result, platform as any, isReel);
        }
      }
    } else if (contentType.startsWith('video/')) {
      result.mediaType = 'video';
      
      // For videos, we can't easily get dimensions without ffprobe
      // We'll add basic size/type validation and warn about aspect ratio
      result.warnings.push({
        platform: 'linkedin',
        severity: 'info',
        message: 'Certifique-se que o vídeo tem aspect ratio entre 1:2.4 e 2.4:1'
      });
      
      // Validate video duration and size for each platform
      for (const platform of platforms) {
        validateVideoForPlatform(result, platform as any, isReel);
      }
    } else {
      result.isValid = false;
      result.warnings.push({
        platform: 'linkedin',
        severity: 'error',
        message: `Tipo de mídia não suportado: ${contentType}`
      });
    }

  } catch (error: any) {
    console.error('[MediaValidator] Error validating media:', error.message);
    result.isValid = false;
    result.warnings.push({
      platform: 'linkedin',
      severity: 'error',
      message: `Erro ao validar mídia: ${error.message}`
    });
  }

  return result;
}

function validateImageForPlatform(
  result: MediaValidationResult,
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram',
  isReel: boolean
) {
  if (!result.aspectRatio || !result.fileSize) return;

  const requirements = PLATFORM_REQUIREMENTS[platform];
  
  if (isReel && platform === 'facebook') {
    result.warnings.push({
      platform,
      severity: 'error',
      message: 'Reels do Facebook requerem vídeo, não imagem'
    });
    result.isValid = false;
    return;
  }
  
  if (isReel && platform === 'instagram') {
    result.warnings.push({
      platform,
      severity: 'error',
      message: 'Reels do Instagram requerem vídeo, não imagem'
    });
    result.isValid = false;
    return;
  }

  const imageReqs = requirements.image;

  // Check aspect ratio
  if (result.aspectRatio < imageReqs.minAspectRatio) {
    result.warnings.push({
      platform,
      severity: 'warning',
      message: `Imagem muito vertical para ${platform.toUpperCase()}. ` +
        `Aspect ratio ${result.aspectRatio.toFixed(2)} (mínimo: ${imageReqs.minAspectRatio.toFixed(2)}). ` +
        `Pode ser cortada. Recomendado: ${result.width}x${Math.floor(result.width! / imageReqs.minAspectRatio)}`
    });
  } else if (result.aspectRatio > imageReqs.maxAspectRatio) {
    result.warnings.push({
      platform,
      severity: 'warning',
      message: `Imagem muito horizontal para ${platform.toUpperCase()}. ` +
        `Aspect ratio ${result.aspectRatio.toFixed(2)} (máximo: ${imageReqs.maxAspectRatio.toFixed(2)}). ` +
        `Pode ser cortada. Recomendado: ${result.width}x${Math.floor(result.width! / imageReqs.maxAspectRatio)}`
    });
  }

  // Check file size
  if (result.fileSize > imageReqs.maxFileSize) {
    result.warnings.push({
      platform,
      severity: 'error',
      message: `Imagem muito grande para ${platform.toUpperCase()}. ` +
        `Tamanho: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB ` +
        `(máximo: ${(imageReqs.maxFileSize / 1024 / 1024).toFixed(0)}MB)`
    });
    result.isValid = false;
  }

  // Add success message if no warnings for this platform
  const platformWarnings = result.warnings.filter(w => w.platform === platform);
  if (platformWarnings.length === 0) {
    result.warnings.push({
      platform,
      severity: 'info',
      message: `✓ Imagem compatível com ${platform.toUpperCase()} ` +
        `(${result.width}x${result.height}, ratio: ${result.aspectRatio.toFixed(2)})`
    });
  }
}

function validateVideoForPlatform(
  result: MediaValidationResult,
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram',
  isReel: boolean
) {
  if (!result.fileSize) return;

  const requirements = PLATFORM_REQUIREMENTS[platform];
  const videoReqs = isReel && (platform === 'facebook' || platform === 'instagram') 
    ? (requirements as any).reel 
    : requirements.video;

  // Check file size
  if (result.fileSize > videoReqs.maxFileSize) {
    result.warnings.push({
      platform,
      severity: 'error',
      message: `Vídeo muito grande para ${platform.toUpperCase()} ${isReel ? 'Reel' : ''}. ` +
        `Tamanho: ${(result.fileSize / 1024 / 1024).toFixed(2)}MB ` +
        `(máximo: ${(videoReqs.maxFileSize / 1024 / 1024).toFixed(0)}MB)`
    });
    result.isValid = false;
  }

  // Add info about requirements
  if (isReel && (platform === 'facebook' || platform === 'instagram')) {
    result.warnings.push({
      platform,
      severity: 'info',
      message: `Reels ${platform.toUpperCase()}: aspect ratio 9:16 obrigatório, ` +
        `duração ${videoReqs.minDuration}-${videoReqs.maxDuration}s`
    });
  } else {
    result.warnings.push({
      platform,
      severity: 'info',
      message: `Vídeo ${platform.toUpperCase()}: duração ${videoReqs.minDuration}-${videoReqs.maxDuration}s, ` +
        `aspect ratio ${videoReqs.minAspectRatio.toFixed(2)}-${videoReqs.maxAspectRatio.toFixed(2)}`
    });
  }
}

/**
 * Helper function to format aspect ratio as readable string
 */
export function formatAspectRatio(ratio: number): string {
  // Common ratios
  const commonRatios: { [key: string]: number } = {
    '1:1': 1,
    '4:5': 0.8,
    '9:16': 0.5625,
    '16:9': 1.7778,
    '2:1': 2,
    '1.91:1': 1.91
  };

  for (const [name, value] of Object.entries(commonRatios)) {
    if (Math.abs(ratio - value) < 0.01) {
      return name;
    }
  }

  return `${ratio.toFixed(2)}:1`;
}
