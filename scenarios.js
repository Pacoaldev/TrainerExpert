export const techDrills = [
  {
    id: 1,
    title: "Optimización del Problema N+1 en Laravel Eloquent",
    description: "Identifica el problema N+1 en este bloque y optimízalo usando eager loading:",
    code: `// Código original:\n$orders = Order::all();\nforeach ($orders as $order) {\n    echo $order->customer->name;\n}`,
    expectedKeywords: ["with('customer')", "with(\"customer\")", "eager loading", "order::with"],
    solution: `$orders = Order::with('customer')->get();\nforeach ($orders as $order) {\n    echo $order->customer->name;\n}`
  },
  {
    id: 2,
    title: "Búsqueda en tiempo real con RxJS en Angular",
    description: "Completa el operador que cancela la petición anterior si llega una nueva búsqueda:",
    code: `this.searchControl.valueChanges.pipe(\n  debounceTime(300),\n  distinctUntilChanged(),\n  ______((query) => this.productService.search(query))\n).subscribe();`,
    expectedKeywords: ["switchmap"],
    solution: "switchMap"
  },
  {
    id: 3,
    title: "Concurrencia en Stock - Actualización Atómica",
    description: "Escribe la consulta SQL (UPDATE) para restar 7 unidades del stock de forma atómica y segura contra concurrencia:",
    code: `// Completa el UPDATE:\nUPDATE products\nSET stock_quantity = stock_quantity - 7\nWHERE id = 10\n______ ;`,
    expectedKeywords: ["stock_quantity >= 7", "and stock_quantity >= 7"],
    solution: "AND stock_quantity >= 7"
  }
];

export const defaultScenarios = [
  {
    id: 1,
    name: "Caso 1: Módulo de pedidos",
    desc: "Transacciones, estados del pedido y escandallos.",
    caseTopic: "módulo de pedidos en un restaurante (comandas, estados, escandallos)",
    deepening: [
      "¿Cómo diseñarías el módulo de pedidos?",
      "¿Cómo diseñas la base de datos?",
      "¿Y si escalamos a 500 restaurantes simultáneos?",
      "¿Qué pasa si dos usuarios descuentan stock a la vez?",
      "¿Cómo evitas bloqueos si el proceso es lento?",
      "¿Cómo gestionas fallos en procesos en background?"
    ]
  },
  {
    id: 2,
    name: "Caso 2: Generación asíncrona de informes",
    desc: "Asincronía con colas SQS, S3 y polling de estados.",
    caseTopic: "generación asíncrona de informes pesados (colas, S3, polling de estado)",
    deepening: [
      "¿Cómo separarías la petición del usuario del procesamiento pesado?",
      "¿Qué modelo de datos usarías para el estado del informe?",
      "¿Qué pasa si el worker falla a mitad de generación?",
      "¿Cómo evitas procesar el mismo job dos veces?",
      "¿Cómo escala si hay picos de 200 informes simultáneos?"
    ]
  },
  {
    id: 3,
    name: "Caso 3: Concurrencia y descuento de stock",
    desc: "Row locking, conditional update e inventario.",
    caseTopic: "descuento concurrente de stock en inventario multi-restaurante",
    deepening: [
      "¿Cómo modelarías el stock y las reservas?",
      "¿Qué pasa si dos usuarios descuentan stock a la vez?",
      "¿Optimistic o pessimistic locking? ¿Por qué?",
      "¿Cómo evitas bloqueos si el proceso es lento?",
      "¿Qué pasa si el pago falla después de reservar stock?"
    ]
  },
  {
    id: 4,
    name: "Caso 4: Importación masiva de productos",
    desc: "Procesamiento por lotes (chunks) y workers.",
    caseTopic: "importación masiva de catálogo de productos (CSV, chunks, workers)",
    deepening: [
      "¿Procesarías el CSV en la request o en background? ¿Por qué?",
      "¿Cómo partes el fichero en lotes sin perder consistencia?",
      "¿Qué haces si una fila falla validación a mitad del lote?",
      "¿Cómo informas al usuario del progreso?",
      "¿Cómo escala si el catálogo tiene 500.000 filas?"
    ]
  }
];
