export { createMealsModule, type MealsModule } from "./operations.js"

export {
  estimateMeal,
  type EstimateMealOptions,
  type EstimateMealResult,
  MealAnalysis,
  MODELS,
  DEFAULT_VISION_MODEL_ID,
  getModel,
  computeCost,
  type ModelInfo,
  getSystemPrompt,
  buildUserPromptText,
  type Locale,
  type UserPromptParts,
  VisionError,
  MAX_IMAGE_BYTES,
  type VisionErrorCode,
} from "./estimator/index.js"
