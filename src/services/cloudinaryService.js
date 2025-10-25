const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
    /**
     * Subir imagen a Cloudinary
     * @param {string} imageBase64 - Imagen en base64
     * @param {string} folder - Carpeta donde guardar (default: TotalProd)
     * @param {string} publicId - ID público personalizado (opcional)
     * @returns {Promise<Object>} - Resultado de la subida
     */
    static async uploadImage(imageBase64, folder = 'TotalProd', publicId = null) {
        try {
            const options = {
                folder: folder,
                resource_type: 'image',
                quality: 'auto',
                fetch_format: 'auto'
            };

            if (publicId) {
                options.public_id = publicId;
            }

            const result = await cloudinary.uploader.upload(imageBase64, options);
            
            return {
                success: true,
                data: {
                    public_id: result.public_id,
                    secure_url: result.secure_url,
                    original_filename: result.original_filename,
                    format: result.format,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                    created_at: result.created_at
                }
            };
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar imagen de Cloudinary
     * @param {string} publicId - ID público de la imagen
     * @returns {Promise<Object>} - Resultado de la eliminación
     */
    static async deleteImage(publicId) {
        try {
            const result = await cloudinary.uploader.destroy(publicId);
            
            return {
                success: result.result === 'ok',
                data: result
            };
        } catch (error) {
            console.error('Error deleting from Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Actualizar imagen (eliminar la anterior y subir la nueva)
     * @param {string} oldPublicId - ID público de la imagen anterior
     * @param {string} newImageBase64 - Nueva imagen en base64
     * @param {string} folder - Carpeta donde guardar
     * @returns {Promise<Object>} - Resultado de la actualización
     */
    static async updateImage(oldPublicId, newImageBase64, folder = 'TotalProd') {
        try {
            // Primero eliminar la imagen anterior
            if (oldPublicId) {
                const deleteResult = await this.deleteImage(oldPublicId);
                if (!deleteResult.success) {
                    console.warn('Could not delete old image:', deleteResult.error);
                }
            }

            // Subir la nueva imagen
            const uploadResult = await this.uploadImage(newImageBase64, folder);
            
            return uploadResult;
        } catch (error) {
            console.error('Error updating image in Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener información de una imagen
     * @param {string} publicId - ID público de la imagen
     * @returns {Promise<Object>} - Información de la imagen
     */
    static async getImageInfo(publicId) {
        try {
            const result = await cloudinary.api.resource(publicId);
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Error getting image info from Cloudinary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generar URL de transformación
     * @param {string} publicId - ID público de la imagen
     * @param {Object} transformations - Transformaciones a aplicar
     * @returns {string} - URL transformada
     */
    static getTransformedUrl(publicId, transformations = {}) {
        const defaultTransformations = {
            width: 200,
            height: 200,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto',
            fetch_format: 'auto'
        };

        const finalTransformations = { ...defaultTransformations, ...transformations };
        
        return cloudinary.url(publicId, {
            transformation: finalTransformations
        });
    }
}

module.exports = CloudinaryService;
