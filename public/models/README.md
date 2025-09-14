# Face-API.js Models Setup

The emotion detection feature requires downloading the face-api.js models manually due to their large size.

## Required Models

Download these models from the [face-api.js GitHub repository](https://github.com/justadudewhohacks/face-api.js/tree/master/weights):

1. **tiny_face_detector_model-weights_manifest.json**
2. **tiny_face_detector_model-shard1**
3. **face_landmark_68_model-weights_manifest.json**
4. **face_landmark_68_model-shard1**
5. **face_expression_model-weights_manifest.json**
6. **face_expression_model-shard1**
7. **age_gender_model-weights_manifest.json**
8. **age_gender_model-shard1**

## Installation Steps

1. Go to: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
2. Download all the files listed above
3. Place them in this `public/models/` directory
4. Restart the development server

## Alternative Setup

You can also install them via npm:

```bash
cd weekend-harmony
npm install @vladmandic/face-api
```

Then copy from node_modules:
```bash
cp -r node_modules/@vladmandic/face-api/model/* public/models/
```

## Verification

Once models are in place, the emotion detection feature will:
- ✅ Load models without errors
- ✅ Access camera successfully  
- ✅ Detect faces and emotions
- ✅ Provide personalized activity recommendations

The application will still work without these models, but emotion detection will be disabled.
