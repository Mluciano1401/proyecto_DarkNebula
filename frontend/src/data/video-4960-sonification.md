# Sonificación visual del video NASA SVS 4960

## Fuente y alcance

- Ficha/API: [A 3D View of an Atmospheric River from an Earth System Model](https://svs.gsfc.nasa.gov/api/4960/).
- Archivo de entrada: versión no narrada `atmos_river_HD.webm` (1920 × 1080), seleccionada desde los recursos multimedia del API.
- El API identifica MERRA-2 y datos de viento como conjuntos usados en la visualización, pero NASA aclara que la ficha no almacena esos conjuntos ni entrega sus valores numéricos. Por ello, este modo analiza el render del video y no mide directamente vapor de agua, viento ni precipitación.
- El render describe transporte de vapor de agua en tres dimensiones y usa datos/modelos de NASA MERRA-2.

## Preparación de fotogramas

1. Se muestrean 24 instantes distribuidos durante el video.
2. Cada fotograma se procesa con OCR. Si se detecta una palabra de tamaño legible, ese fotograma se omite para que títulos o etiquetas no se conviertan en notas.
3. La app analiza los fotogramas conservados en una cuadrícula de 16 × 9. El brillo y color se promedian entre instantes; la variación de brillo entre fotogramas se suma a la textura visual.

## Interpretación del sonido

- Brillo renderizado → altura de nota.
- Saturación renderizada → intensidad.
- Variación espacial y temporal del brillo → ritmo.
- Posición horizontal → orden/paneo.
- Estas características no tienen unidades físicas. El resultado debe llamarse **sonificación de características visuales del video**, no sonificación directa de datos científicos MERRA-2.
