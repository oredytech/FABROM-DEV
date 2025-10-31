/**
 * Utility functions for Cloudinary integration
 * All uploads are securely processed through edge functions
 */

export interface CloudinaryImageData {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

/**
 * Generate a responsive image tag with Cloudinary transformations
 * @param imageData - Cloudinary image data
 * @param alt - Alternative text for the image
 * @param className - Optional CSS classes
 * @returns HTML string for responsive image
 */
export const generateResponsiveImageTag = (
  imageData: CloudinaryImageData,
  alt: string,
  className: string = ""
): string => {
  // Extract base URL and public ID
  const baseUrl = imageData.url.split('/upload/')[0];
  const pathAfterUpload = imageData.url.split('/upload/')[1];
  
  // Generate responsive variants
  const sizes = [
    { width: 320, suffix: 'mobile' },
    { width: 768, suffix: 'tablet' },
    { width: 1024, suffix: 'desktop' },
  ];
  
  const srcset = sizes
    .map(({ width, suffix }) => 
      `${baseUrl}/upload/w_${width},f_auto,q_auto/${pathAfterUpload} ${width}w`
    )
    .join(', ');
  
  return `<img 
    src="${imageData.url}" 
    srcset="${srcset}"
    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
    alt="${alt}"
    ${className ? `class="${className}"` : ''}
    loading="lazy"
    width="${imageData.width}"
    height="${imageData.height}"
  />`;
};

/**
 * Generate a background image URL with transformations
 * @param imageUrl - Original Cloudinary URL
 * @param width - Desired width
 * @param height - Desired height
 * @returns Transformed image URL
 */
export const generateBackgroundImage = (
  imageUrl: string,
  width: number,
  height: number
): string => {
  const baseUrl = imageUrl.split('/upload/')[0];
  const pathAfterUpload = imageUrl.split('/upload/')[1];
  
  return `${baseUrl}/upload/w_${width},h_${height},c_fill,f_auto,q_auto/${pathAfterUpload}`;
};

/**
 * Extract dominant colors from a Cloudinary image
 * @param imageUrl - Original Cloudinary URL
 * @returns URL for image with dominant colors overlay
 */
export const getImageWithColors = (imageUrl: string): string => {
  const baseUrl = imageUrl.split('/upload/')[0];
  const pathAfterUpload = imageUrl.split('/upload/')[1];
  
  return `${baseUrl}/upload/e_colorize:50,co_rgb:000000/${pathAfterUpload}`;
};
