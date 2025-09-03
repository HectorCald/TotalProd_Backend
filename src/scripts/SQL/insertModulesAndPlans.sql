-- Insertar módulos disponibles
INSERT INTO modules (name, description) VALUES
('Clientes', 'Gestión completa de clientes con mapa interactivo'),
('Reportes', 'Generación de reportes y estadísticas'),
('Usuarios', 'Administración de usuarios del sistema'),
('Productos', 'Gestión de inventario y productos'),
('Proveedores', 'Administración de proveedores'),
('Ventas', 'Módulo de ventas y facturación'),
('Configuración', 'Configuración del sistema');

-- Insertar planes
INSERT INTO plans (name, price, duration) VALUES
('Free', 0, '1 month'),
('Basic', 9.99, '1 month'),
('Premium', 19.99, '1 month'),
('Enterprise', 49.99, '1 month');

-- Obtener IDs de los planes (esto se haría en la aplicación, pero para el ejemplo)
-- Asumiendo que los IDs son generados automáticamente

-- Asociar módulos con planes
-- Plan Free: Solo Clientes básico
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id
FROM plans p, modules m
WHERE p.name = 'Free' AND m.name = 'Clientes';

-- Plan Basic: Clientes + Reportes
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id
FROM plans p, modules m
WHERE p.name = 'Basic' AND m.name IN ('Clientes', 'Reportes');

-- Plan Premium: Clientes + Reportes + Usuarios + Productos
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id
FROM plans p, modules m
WHERE p.name = 'Premium' AND m.name IN ('Clientes', 'Reportes', 'Usuarios', 'Productos');

-- Plan Enterprise: Todos los módulos
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id
FROM plans p, modules m
WHERE p.name = 'Enterprise';
