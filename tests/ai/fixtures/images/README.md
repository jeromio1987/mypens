# Live eval image fixtures

Drop real photos here (`.jpg`, `.jpeg`, `.png`, `.webp`) to extend the vision half of `npm run eval:ai`. Everything in this folder except this README is gitignored, because food photos and lab reports are personal data.

The eval skips the image tests when this folder holds no images, so an empty folder is a valid state.

Good candidates:

- one nutrition-label photo where you know the printed values
- one packaged product front-of-pack
- one plated meal
- one lab report page

The eval asserts that the response matches `FOOD_VISION_SCHEMA` and survives the normaliser. It does not assert exact kcal numbers, since the model is allowed to estimate. If you want a value regression test, add the expected numbers to `tests/ai/schemas.test.ts` as a golden JSON fixture instead.
