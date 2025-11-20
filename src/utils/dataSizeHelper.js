/**
 * Calcula el tamaño de datos en diferentes unidades
 * @param {any} data - Los datos a calcular
 * @returns {object} Objeto con sizeBytes, sizeKB y sizeMB
 */
const calculateDataSize = (data) => {
  try {
    // Convertir los datos a JSON string para calcular el tamaño
    const jsonString = JSON.stringify(data);
    // Calcular tamaño en bytes
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
    // Convertir a KB
    const sizeInKB = sizeInBytes / 1024;
    // Convertir a MB
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    return {
      sizeBytes: sizeInBytes,
      sizeKB: parseFloat(sizeInKB.toFixed(2)),
      sizeMB: parseFloat(sizeInMB.toFixed(4))
    };
  } catch (error) {
    console.error('Error calculando tamaño de datos:', error);
    return {
      sizeBytes: 0,
      sizeKB: 0,
      sizeMB: 0
    };
  }
};

/**
 * Calcula los tamaños separados de productos (base, con recetas, con precios, total)
 * @param {Array} products - Array de productos
 * @returns {object} Objeto con tamaños separados
 */
const calculateProductsSizes = (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      productosBase: { sizeBytes: 0, sizeKB: 0, sizeMB: 0 },
      productosConRecetas: { sizeBytes: 0, sizeKB: 0, sizeMB: 0 },
      productosConPrecios: { sizeBytes: 0, sizeKB: 0, sizeMB: 0 },
      total: { sizeBytes: 0, sizeKB: 0, sizeMB: 0 }
    };
  }

  // 1. Productos base (sin recetas ni precios)
  const productosBase = products.map(producto => {
    const { recetas, price_product, productos_sucursal, ...productoBase } = producto;
    return productoBase;
  });
  const sizeBase = calculateDataSize(productosBase);

  // 2. Productos con recetas (sin precios)
  const productosConRecetas = products.map(producto => {
    const { price_product, productos_sucursal, ...productoConReceta } = producto;
    return productoConReceta;
  });
  const sizeConRecetas = calculateDataSize(productosConRecetas);

  // 3. Productos con precios (sin recetas)
  const productosConPrecios = products.map(producto => {
    const { recetas, productos_sucursal, ...productoConPrecio } = producto;
    return productoConPrecio;
  });
  const sizeConPrecios = calculateDataSize(productosConPrecios);

  // 4. Total (productos completos con todo)
  const sizeTotal = calculateDataSize(products);

  return {
    productosBase: sizeBase,
    productosConRecetas: sizeConRecetas,
    productosConPrecios: sizeConPrecios,
    total: sizeTotal
  };
};

/**
 * Loggea los tamaños de productos en la consola del backend
 * @param {object} sizes - Objeto con los tamaños calculados
 * @param {string} method - Método que generó los datos
 */
const logProductsSizes = (sizes, method = 'getAll') => {
  console.log('\n📊 [DATA SIZE LOG] ===========================================');
  console.log(`📦 Método: ${method}`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`🔹 Productos Base (sin recetas, sin precios):`);
  console.log(`   ${sizes.productosBase.sizeKB} KB (${sizes.productosBase.sizeMB} MB)`);
  console.log(`   ${sizes.productosBase.sizeBytes} bytes`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`🔹 Productos con Recetas (sin precios):`);
  console.log(`   ${sizes.productosConRecetas.sizeKB} KB (${sizes.productosConRecetas.sizeMB} MB)`);
  console.log(`   ${sizes.productosConRecetas.sizeBytes} bytes`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`🔹 Productos con Precios (sin recetas):`);
  console.log(`   ${sizes.productosConPrecios.sizeKB} KB (${sizes.productosConPrecios.sizeMB} MB)`);
  console.log(`   ${sizes.productosConPrecios.sizeBytes} bytes`);
  console.log('─────────────────────────────────────────────────────');
  console.log(`🔹 Total (productos completos):`);
  console.log(`   ${sizes.total.sizeKB} KB (${sizes.total.sizeMB} MB)`);
  console.log(`   ${sizes.total.sizeBytes} bytes`);
  console.log('=====================================================\n');
};

module.exports = {
  calculateDataSize,
  calculateProductsSizes,
  logProductsSizes
};


