# Especificación inicial del piloto 5011

## Fuente y alcance

- Visualización relacionada: [NASA SVS 5011](https://svs.gsfc.nasa.gov/5011/), eventos detectados por LIS en la Estación Espacial Internacional.
- Primera capa numérica: [ISS LIS Annual Thunder Hour](https://data.nasa.gov/dataset/international-space-station-iss-lightning-imaging-sensor-lis-annual-thunder-hour), producto NetCDF-4 de NASA GHRC.
- Variable: promedio de horas por año en que se observaron al menos dos centroides de grupos LIS a menos de 15 km de cada punto de la grilla.
- Unidad: horas/año.
- Periodo de observación: 1 de marzo de 2017 a 16 de noviembre de 2023.
- Resolución publicada: 0,05° de latitud y longitud; cobertura de latitud 54,75° S a 54,75° N.

Esta capa representa frecuencia histórica de tormentas derivada de las observaciones de LIS. No representa directamente el color del mapa ni reproduce la secuencia de ventanas móviles de 10 días de la animación SVS 5011.

## Mapeo sonoro acordado para el primer prototipo

1. **Valor de la variable → altura de nota.** Más horas/año produce una nota más aguda. El mínimo y máximo del rango deben leerse del NetCDF y quedar fijos para todas las regiones; no se normaliza cada imagen por separado.
2. **Ubicación → orden de recorrido y descripción.** La primera vista usará una cuadrícula de 16 columnas por 9 filas, coincidente con la interfaz actual. Las columnas dividen longitud oeste-este en bandas de 22,5°; las filas dividen la cobertura de latitud norte-sur en nueve bandas iguales. Cada bloque se anuncia con sus límites geográficos y valor. Las bandas no representan áreas de igual superficie.
3. **Longitud → paneo opcional.** El paneo podrá ayudar a ubicar regiones este-oeste, pero la dirección también se comunica en texto y en el orden de navegación, de modo que la información no dependa del estéreo.
4. **Estilo sonoro → timbre solamente.** Ambiental, clásica y electrónica no cambian la nota asociada al valor, la región ni el orden del recorrido.
5. **Datos ausentes → estado diferenciado.** Un valor de relleno o sin observación no se convierte en cero. Se omite del tono y se comunica como “sin dato” en texto.

## Reducción espacial

La grilla NASA es demasiado densa para sonar punto por punto. Primero hay que ofrecer una vista general con bloques geográficos definidos y resumir cada bloque con una estadística declarada. Para el primer prototipo se propone el **promedio de horas/año válidas por bloque**; una opción de detalle permitirá recorrer celdas más pequeñas. No se debe mezclar mar, tierra y datos ausentes como si fueran valores cero.

El estilo musical modifica la síntesis, no la escala de notas. Si se ofrece HSL, debe ser un modo aparte de “exploración visual”: tono, saturación y luminosidad describen la imagen renderizada, no reemplazan la variable anual de horas de tormenta.

El tamaño de bloque final depende de las dimensiones y máscaras reales del NetCDF. Antes de cerrar el rango sonoro hay que inspeccionar sus variables, valores de relleno, límites, min/max y coordenadas.

## Validación pendiente antes de programar el análisis

- Descargar el único NetCDF-4 enlazado por NASA y comprobar licencia, metadatos, nombres de variables, unidades y valor de relleno.
- Confirmar que el dato incluye una máscara de ausencia y verificar min/max reales.
- Comparar una región y el mapa agregado con una visualización NASA para confirmar orientación, cobertura y sentido de los valores.
- Mantener la animación de 10 días como una fuente o modo distinto; no presentarla como si fuera esta medida anual.
