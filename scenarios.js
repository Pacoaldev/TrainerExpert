export const techDrills = [
  {
    id: 1,
    title: "Optimización del Problema N+1 en Laravel Eloquent",
    description: "Identifica el problema N+1 en este bloque y optimízalo usando eager loading:",
    code: `// Código original:\n$orders = Order::all();\nforeach ($orders as $order) {\n    echo $order->customer->name;\n}`,
    expectedKeywords: ["with", "customer", "eager loading", "queries"],
    solution: `$orders = Order::with('customer')->get();\nforeach ($orders as $order) {\n    echo $order->customer->name;\n}`
  },
  {
    id: 2,
    title: "Búsqueda en tiempo real con RxJS en Angular",
    description: "Completa el operador que cancela la petición anterior si llega una nueva búsqueda:",
    code: `this.searchControl.valueChanges.pipe(\n  debounceTime(300),\n  distinctUntilChanged(),\n  ______((query) => this.productService.search(query))\n).subscribe();`,
    expectedKeywords: ["switchMap"],
    solution: "switchMap"
  },
  {
    id: 3,
    title: "Concurrencia en Stock - Actualización Atómica",
    description: "Escribe la consulta SQL (UPDATE) para restar 7 unidades del stock de forma atómica y segura contra concurrencia:",
    code: `// Completa el UPDATE:\nUPDATE products\nSET stock_quantity = stock_quantity - 7\nWHERE id = 10\n______ ;`,
    expectedKeywords: ["AND stock_quantity >= 7", "stock_quantity >= 7"],
    solution: "AND stock_quantity >= 7"
  }
];

export const defaultScenarios = [
  { id: 1, name: "Caso 1: Módulo de pedidos", desc: "Transacciones, estados del pedido y escandallos." },
  { id: 2, name: "Caso 2: Generación asíncrona de informes", desc: "Asincronía con colas SQS, S3 y polling de estados." },
  { id: 3, name: "Caso 3: Concurrencia y descuento de stock", desc: "Row locking, conditional update e inventario." },
  { id: 4, name: "Caso 4: Importación masiva de productos", desc: "Procesamiento por lotes (chunks) y workers." }
];
