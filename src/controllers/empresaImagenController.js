const { supabase } = require('../config/supabase');
const CloudinaryService = require('../services/cloudinaryService');

class EmpresaImagenController {
    /**
     * Crear nueva imagen de empresa
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async create(req, res) {
        try {
            const { image, empresa_id } = req.body; // Imagen en base64 y ID de empresa

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'La imagen es requerida'
                });
            }

            if (!empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de empresa es requerido'
                });
            }

            // Debug: verificar el empresa_id
            console.log('Empresa ID from frontend:', empresa_id);
            
            // Obtener la empresa directamente por ID
            const { data: empresa, error: empresaError } = await supabase
                .from('empresas')
                .select('id, logo_tipo')
                .eq('id', empresa_id)
                .single();

            console.log('Empresa query result:', { empresa, empresaError });

            if (empresaError || !empresa) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la empresa'
                });
            }

            // Si ya tiene una imagen, eliminar la anterior de Cloudinary
            if (empresa.logo_tipo) {
                // Extraer public_id de la URL de Cloudinary
                const urlParts = empresa.logo_tipo.split('/');
                const publicId = urlParts[urlParts.length - 1].split('.')[0];
                await CloudinaryService.deleteImage(publicId);
            }

            // Subir nueva imagen a Cloudinary
            const uploadResult = await CloudinaryService.uploadImage(image, 'TotalProd');
            
            if (!uploadResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al subir la imagen',
                    error: uploadResult.error
                });
            }

            // Actualizar la columna logo_tipo en la tabla empresas
            const { data: updatedEmpresa, error: updateError } = await supabase
                .from('empresas')
                .update({ logo_tipo: uploadResult.data.secure_url })
                .eq('id', empresa.id)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al actualizar la imagen en la base de datos',
                    error: updateError.message
                });
            }

            res.status(201).json({
                success: true,
                message: 'Imagen de empresa creada exitosamente',
                data: {
                    secure_url: uploadResult.data.secure_url,
                    public_id: uploadResult.data.public_id,
                    original_filename: uploadResult.data.original_filename,
                    format: uploadResult.data.format,
                    bytes: uploadResult.data.bytes,
                    width: uploadResult.data.width,
                    height: uploadResult.data.height
                }
            });

        } catch (error) {
            console.error('Error creating empresa imagen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener imagen de empresa del usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async getByUserId(req, res) {
        try {
            const { empresa_id } = req.query;

            if (!empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de empresa es requerido'
                });
            }

            // Obtener la empresa directamente por ID
            const { data: empresa, error: empresaError } = await supabase
                .from('empresas')
                .select('id, logo_tipo')
                .eq('id', empresa_id)
                .single();

            if (empresaError || !empresa) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la empresa'
                });
            }

            if (!empresa.logo_tipo) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró imagen de empresa'
                });
            }

            res.json({
                success: true,
                data: {
                    secure_url: empresa.logo_tipo
                }
            });

        } catch (error) {
            console.error('Error getting empresa imagen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Actualizar imagen de empresa
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async update(req, res) {
        try {
            const { image, empresa_id } = req.body;

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'La imagen es requerida'
                });
            }

            if (!empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de empresa es requerido'
                });
            }

            // Obtener la empresa directamente por ID
            const { data: empresa, error: empresaError } = await supabase
                .from('empresas')
                .select('id, logo_tipo')
                .eq('id', empresa_id)
                .single();

            if (empresaError || !empresa) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la empresa'
                });
            }

            // Si ya tiene una imagen, eliminar la anterior de Cloudinary
            if (empresa.logo_tipo) {
                // Extraer public_id de la URL de Cloudinary
                const urlParts = empresa.logo_tipo.split('/');
                const publicId = urlParts[urlParts.length - 1].split('.')[0];
                await CloudinaryService.deleteImage(publicId);
            }

            // Subir nueva imagen a Cloudinary
            const uploadResult = await CloudinaryService.uploadImage(image, 'TotalProd');
            
            if (!uploadResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al subir la imagen',
                    error: uploadResult.error
                });
            }

            // Actualizar la columna logo_tipo en la tabla empresas
            const { data: updatedEmpresa, error: updateError } = await supabase
                .from('empresas')
                .update({ logo_tipo: uploadResult.data.secure_url })
                .eq('id', empresa.id)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al actualizar la imagen en la base de datos',
                    error: updateError.message
                });
            }

            res.json({
                success: true,
                message: 'Imagen de empresa actualizada exitosamente',
                data: {
                    secure_url: uploadResult.data.secure_url,
                    public_id: uploadResult.data.public_id,
                    original_filename: uploadResult.data.original_filename,
                    format: uploadResult.data.format,
                    bytes: uploadResult.data.bytes,
                    width: uploadResult.data.width,
                    height: uploadResult.data.height
                }
            });

        } catch (error) {
            console.error('Error updating empresa imagen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Eliminar imagen de empresa
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async delete(req, res) {
        try {
            const { empresa_id } = req.query;

            if (!empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de empresa es requerido'
                });
            }

            // Obtener la empresa directamente por ID
            const { data: empresa, error: empresaError } = await supabase
                .from('empresas')
                .select('id, logo_tipo')
                .eq('id', empresa_id)
                .single();

            if (empresaError || !empresa) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la empresa'
                });
            }

            if (!empresa.logo_tipo) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró imagen de empresa para eliminar'
                });
            }

            // Eliminar imagen de Cloudinary
            const urlParts = empresa.logo_tipo.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];
            const deleteResult = await CloudinaryService.deleteImage(publicId);

            if (!deleteResult.success) {
                console.warn('Could not delete image from Cloudinary:', deleteResult.error);
                // Continuar con la eliminación de la base de datos aunque falle en Cloudinary
            }

            // Limpiar la columna logo_tipo en la tabla empresas
            const { error: updateError } = await supabase
                .from('empresas')
                .update({ logo_tipo: null })
                .eq('id', empresa.id);

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al eliminar la imagen de la base de datos',
                    error: updateError.message
                });
            }

            res.json({
                success: true,
                message: 'Imagen de empresa eliminada exitosamente'
            });

        } catch (error) {
            console.error('Error deleting empresa imagen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    /**
     * Obtener URL transformada de la imagen
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    static async getTransformedUrl(req, res) {
        try {
            const { user_id } = req.user;
            const { width = 200, height = 200, crop = 'fill', gravity = 'face' } = req.query;

            // Obtener la empresa del usuario con su logo
            const { data: empresa, error: empresaError } = await supabase
                .from('empresas')
                .select('id, logo_tipo')
                .eq('propietario_id', user_id)
                .single();

            if (empresaError || !empresa) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la empresa del usuario'
                });
            }

            if (!empresa.logo_tipo) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró imagen de empresa'
                });
            }

            // Extraer public_id de la URL de Cloudinary
            const urlParts = empresa.logo_tipo.split('/');
            const publicId = urlParts[urlParts.length - 1].split('.')[0];

            const transformedUrl = CloudinaryService.getTransformedImageUrl(publicId, {
                width: parseInt(width),
                height: parseInt(height),
                crop: crop,
                gravity: gravity
            });

            res.json({
                success: true,
                data: {
                    original_url: empresa.logo_tipo,
                    transformed_url: transformedUrl,
                    public_id: publicId
                }
            });

        } catch (error) {
            console.error('Error getting transformed URL:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = EmpresaImagenController;
