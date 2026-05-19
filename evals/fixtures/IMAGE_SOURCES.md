# Image sources

All 10 images are from the **Nutrition5K** dataset published by Google Research
in 2021. Each dish was physically prepared in Google's cafeteria, placed on an
electronic scale, and recorded with both a top-down RGB-D camera and a
rotating side-camera. The per-ingredient mass was logged at preparation time
and multiplied by USDA per-100g nutrient values to compute total kcal and
macros — i.e. **the ground truth is a real measurement, not a recipe estimate
or a hand guess**.

| File | Nutrition5K dish ID | Measured kcal |
|---|---|---|
| `dish_1558459115.jpg` | `dish_1558459115` | 271 |
| `dish_1558380557.jpg` | `dish_1558380557` | 699 |
| `dish_1558724959.jpg` | `dish_1558724959` | 581 |
| `dish_1561739238.jpg` | `dish_1561739238` | 274 |
| `dish_1564761488.jpg` | `dish_1564761488` | 328 |
| `dish_1558724031.jpg` | `dish_1558724031` | 359 |
| `dish_1559838402.jpg` | `dish_1559838402` | 223 |
| `dish_1562691032.jpg` | `dish_1562691032` | 420 |
| `dish_1563207364.jpg` | `dish_1563207364` | 309 |
| `dish_1563468327.jpg` | `dish_1563468327` | 352 |

Images downloaded from
`https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/imagery/realsense_overhead/<dish_id>/rgb.png`
then resized to 1024px long-edge JPEG q85 to match the PRD §10 production
preprocessing.

## License & citation

Nutrition5K is released by Google Research under a license that permits
research and benchmarking use. Cite the paper if publishing:

> Thames, Q., et al. "Nutrition5k: Towards Automatic Nutritional
> Understanding of Generic Food." CVPR 2021.

## Cuisine caveat

All Nutrition5K dishes were prepared in Google's cafeteria — Western /
American food only. **There are zero Middle Eastern dishes in this benchmark.**
Cultural-recognition testing (kabsa, hummus, falafel, mansaf, etc.) needs a
separate, hand-photographed eval set since no measured-GT dataset exists for
MENA cuisine.
