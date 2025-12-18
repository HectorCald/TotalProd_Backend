const EmailService = require('./emailService');
const PDFDocument = require('pdfkit');
const { supabase } = require('../config/supabase');

class MovimientoLogService {
    constructor() {
        this.emailService = new EmailService();
        this.logs = [];
    }

    // Agregar log al buffer
    addLog(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        this.logs.push({
            timestamp,
            level, // 'info', 'success', 'warning', 'error'
            message,
            data
        });

        // También mostrar en consola con formato mejorado
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };
        console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`, data && Object.keys(data).length > 0 ? data : '');
    }

    // Limpiar logs
    clearLogs() {
        this.logs = [];
    }

    // Generar PDF con los logs
    async generatePDF(movimientoData, productosInfo) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));

                // Colores
                const colors = {
                    primary: '#007bff',
                    success: '#28a745',
                    danger: '#dc3545',
                    warning: '#ffc107',
                    dark: '#333333',
                    light: '#6c757d'
                };

                // Header
                doc.fontSize(22)
                   .fillColor(colors.primary)
                   .text('LOG DE MOVIMIENTO', { align: 'center' })
                   .moveDown(0.3);

                doc.fontSize(9)
                   .fillColor(colors.light)
                   .text(`Generado el ${new Date().toLocaleString('es-ES')}`, { align: 'center' })
                   .moveDown(1);

                // Información del movimiento
                doc.fontSize(14)
                   .fillColor(colors.dark)
                   .text('Informacion del Movimiento', { underline: true })
                   .moveDown(0.3);

                const tipoColor = movimientoData.type === 'entrada' ? colors.success : colors.danger;
                const tipoText = movimientoData.type === 'entrada' ? 'ENTRADA' : 'SALIDA';

                doc.fontSize(11)
                   .fillColor(colors.dark)
                   .text(`Tipo: `, { continued: true })
                   .fillColor(tipoColor)
                   .text(tipoText)
                   .fillColor(colors.dark)
                   .text(`ID: ${movimientoData.id || 'N/A'}`)
                   .text(`Fecha: ${new Date(movimientoData.fecha).toLocaleString('es-ES') || new Date().toLocaleString('es-ES')}`)
                   .text(`Estado: ${movimientoData.estado || 'finalizado'}`)
                   .text(`Sucursal: ${movimientoData.sucursal_name || 'N/A'}`)
                   .text(`Empresa: ${movimientoData.empresa_name || 'N/A'}`)
                   .moveDown(0.3);

                if (movimientoData.observaciones) {
                    doc.text(`Observaciones: ${movimientoData.observaciones}`)
                       .moveDown(0.3);
                }

                if (movimientoData.metodo_pago) {
                    doc.text(`Metodo de pago: ${movimientoData.metodo_pago}`)
                       .moveDown(0.3);
                }

                // Productos
                doc.moveDown(0.5)
                   .fontSize(14)
                   .fillColor(colors.dark)
                   .text('Productos', { underline: true })
                   .moveDown(0.3);

                productosInfo.forEach((producto, index) => {
                    // Solo agregar página si realmente no hay espacio (menos de 80 puntos)
                    if (doc.y > 720) {
                        doc.addPage();
                    }

                    doc.fontSize(10)
                       .fillColor(colors.dark)
                       .text(`${index + 1}. ${producto.nombre}`, { bold: true })
                       .fontSize(9)
                       .fillColor(colors.light)
                       .text(`   ID: ${producto.id}`)
                       .text(`   Cantidad: ${producto.cantidad}`)
                       .text(`   Stock anterior: ${producto.stockAnterior || 0}`)
                       .fillColor(producto.stockNuevo < (producto.stockAnterior || 0) ? colors.danger : colors.success)
                       .text(`   Stock nuevo: ${producto.stockNuevo}`)
                       .fillColor(colors.dark)
                       .text(`   Operacion: ${producto.operacion}`)
                       .moveDown(0.2);
                });

                // Timeline de logs (solo si hay espacio, sino nueva página)
                if (doc.y > 600) {
                    doc.addPage();
                }

                doc.moveDown(0.5)
                   .fontSize(14)
                   .fillColor(colors.dark)
                   .text('Timeline de Operaciones', { underline: true })
                   .moveDown(0.3);

                this.logs.forEach((log, index) => {
                    if (doc.y > 720) {
                        doc.addPage();
                    }

                    const logColor = {
                        'info': colors.primary,
                        'success': colors.success,
                        'warning': colors.warning,
                        'error': colors.danger
                    }[log.level] || colors.dark;

                    const logPrefix = {
                        'info': '[INFO]',
                        'success': '[OK]',
                        'warning': '[WARN]',
                        'error': '[ERROR]'
                    }[log.level] || '[LOG]';

                    // Limpiar mensaje de emojis y caracteres especiales
                    let cleanMessage = log.message
                        .replace(/[^\x00-\x7F]/g, '') // Remover caracteres no-ASCII
                        .replace(/\s+/g, ' ') // Normalizar espacios
                        .trim();

                    doc.fontSize(8)
                       .fillColor(colors.light)
                       .text(`[${new Date(log.timestamp).toLocaleTimeString('es-ES')}] `, { continued: true })
                       .fillColor(logColor)
                       .text(`${logPrefix} ${cleanMessage}`)
                       .moveDown(0.15);
                });

                // Footer
                doc.fontSize(7)
                   .fillColor(colors.light)
                   .text(
                       `TotalProd - Sistema de Gestion de Inventarios (c) ${new Date().getFullYear()}`,
                       50,
                       doc.page.height - 50,
                       { align: 'center' }
                   );

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Enviar email con logs
    async sendLogEmail(movimientoData, productosInfo, empresaNombre) {
        try {
            // Solo enviar si la empresa es "hhco"
            if (empresaNombre?.toLowerCase() !== 'Damabrava') {
                this.addLog('info', `No se envía email de log (empresa: ${empresaNombre || 'N/A'})`);
                return { success: true, skipped: true };
            }

            this.addLog('info', 'Generando PDF con logs...');
            
            // Generar PDF
            const pdfBuffer = await this.generatePDF(movimientoData, productosInfo);
            const pdfBase64 = pdfBuffer.toString('base64');

            this.addLog('success', 'PDF generado correctamente');

            // Preparar email
            const tipoMovimiento = movimientoData.type === 'entrada' ? 'ENTRADA' : 'SALIDA';
            const fecha = new Date().toLocaleString('es-ES');
            
            const htmlContent = this.generateEmailHTML(movimientoData, productosInfo);

            const emailData = {
                sender: {
                    name: 'TotalProd Logs',
                    email: process.env.FROM_EMAIL || 'hi.hector20@gmail.com'
                },
                to: [
                    {
                        email: 'patiserrudo2@gmail.com',
                        name: 'Patricia Serrudo'
                    }
                ],
                subject: `📊 Log de ${tipoMovimiento} - ${fecha}`,
                htmlContent: htmlContent,
                attachment: [
                    {
                        content: pdfBase64,
                        name: `log_movimiento_${movimientoData.id}_${Date.now()}.pdf`
                    }
                ]
            };

            this.addLog('info', 'Enviando email con PDF adjunto...');

            const response = await this.emailService.sendEmail(emailData);

            if (response.success) {
                this.addLog('success', 'Email con logs enviado correctamente');
                return { success: true, messageId: response.messageId };
            } else {
                this.addLog('error', 'Error al enviar email con logs', { error: response.error });
                return { success: false, error: response.error };
            }
        } catch (error) {
            this.addLog('error', 'Error al enviar log por email', { error: error.message });
            console.error('Error en sendLogEmail:', error);
            return { success: false, error: error.message };
        }
    }

    // Generar HTML del email
    generateEmailHTML(movimientoData, productosInfo) {
        const tipoMovimiento = movimientoData.type === 'entrada' ? '📥 ENTRADA' : '📤 SALIDA';
        const tipoColor = movimientoData.type === 'entrada' ? '#28a745' : '#dc3545';
        
        const productosHTML = productosInfo.map((producto, index) => {
            const stockColor = producto.stockNuevo < producto.stockAnterior ? '#dc3545' : '#28a745';
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${index + 1}</td>
                    <td style="padding: 10px;"><strong>${producto.nombre}</strong></td>
                    <td style="padding: 10px; text-align: center;">${producto.cantidad}</td>
                    <td style="padding: 10px; text-align: center;">${producto.stockAnterior}</td>
                    <td style="padding: 10px; text-align: center; color: ${stockColor}; font-weight: bold;">
                        ${producto.stockNuevo}
                    </td>
                    <td style="padding: 10px; font-family: monospace; font-size: 12px;">
                        ${producto.operacion}
                    </td>
                </tr>
            `;
        }).join('');

        const logsHTML = this.logs.slice(-20).map(log => {
            const logColor = {
                'info': '#007bff',
                'success': '#28a745',
                'warning': '#ffc107',
                'error': '#dc3545'
            }[log.level] || '#333';

            const logEmoji = {
                'info': 'ℹ️',
                'success': '✅',
                'warning': '⚠️',
                'error': '❌'
            }[log.level] || '📝';

            return `
                <div style="margin-bottom: 8px; padding: 8px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid ${logColor};">
                    <span style="color: #6c757d; font-size: 11px;">
                        ${new Date(log.timestamp).toLocaleTimeString('es-ES')}
                    </span>
                    <span style="color: ${logColor}; font-weight: bold;">
                        ${logEmoji} ${log.message}
                    </span>
                </div>
            `;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Log de Movimiento</title>
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 10px;">
                            📊 TotalProd - Log de Movimiento
                        </div>
                        <h1 style="margin: 0; color: ${tipoColor};">${tipoMovimiento}</h1>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #333;">📋 Información del Movimiento</h3>
                        <p style="margin: 5px 0;"><strong>ID:</strong> ${movimientoData.id || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Fecha:</strong> ${movimientoData.fecha || new Date().toLocaleString('es-ES')}</p>
                        <p style="margin: 5px 0;"><strong>Sucursal:</strong> ${movimientoData.sucursal_name || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Empresa:</strong> ${movimientoData.empresa_name || 'N/A'}</p>
                        ${movimientoData.metodo_pago ? `<p style="margin: 5px 0;"><strong>Método de pago:</strong> ${movimientoData.metodo_pago}</p>` : ''}
                        ${movimientoData.observaciones ? `<p style="margin: 5px 0;"><strong>Observaciones:</strong> ${movimientoData.observaciones}</p>` : ''}
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333;">📦 Productos (${productosInfo.length})</h3>
                        <table style="width: 100%; border-collapse: collapse; background-color: #fff;">
                            <thead>
                                <tr style="background-color: #007bff; color: white;">
                                    <th style="padding: 10px; text-align: left;">#</th>
                                    <th style="padding: 10px; text-align: left;">Producto</th>
                                    <th style="padding: 10px; text-align: center;">Cantidad</th>
                                    <th style="padding: 10px; text-align: center;">Stock Ant.</th>
                                    <th style="padding: 10px; text-align: center;">Stock Nuevo</th>
                                    <th style="padding: 10px; text-align: left;">Operación</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productosHTML}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333;">⏱️ Timeline de Operaciones</h3>
                        <div style="max-height: 400px; overflow-y: auto; padding: 10px; background-color: #f8f9fa; border-radius: 8px;">
                            ${logsHTML}
                        </div>
                    </div>
                    
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                        <strong>📎 Nota:</strong> El PDF adjunto contiene el log completo con todos los detalles.
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                        <p>Este es un email automático del sistema de logs.</p>
                        <p>&copy; ${new Date().getFullYear()} TotalProd. Todos los derechos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Obtener nombres de productos
    async getProductosNombres(productIds) {
        try {
            const { data, error } = await supabase
                .from('products_almacen')
                .select('id, name')
                .in('id', productIds);

            if (error) {
                this.addLog('warning', 'No se pudieron obtener nombres de productos', { error: error.message });
                return {};
            }

            const nombresMap = {};
            data.forEach(producto => {
                nombresMap[producto.id] = producto.name;
            });

            return nombresMap;
        } catch (error) {
            this.addLog('error', 'Error obteniendo nombres de productos', { error: error.message });
            return {};
        }
    }
}

module.exports = MovimientoLogService;

