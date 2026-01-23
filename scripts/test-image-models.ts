import { generateImage, IMAGE_MODELS } from './lib/pollinations';

async function testModels() {
    console.log('Testing AI Image Models...');

    for (const model of IMAGE_MODELS) {
        console.log(`\nTesting model: ${model.name} (${model.id})`);
        const result = await generateImage('A beautiful sunset over a calm ocean', undefined, { model: model.id });

        if (result.success) {
            console.log(`✅ Success! URL: ${result.imageData}`);
            // Check if model parameter is in the URL
            if (result.imageData?.includes(`model=${model.id}`)) {
                console.log(`   - Model parameter correctly included.`);
            } else {
                console.log(`   - ❌ Model parameter MISSING from URL!`);
            }
        } else {
            console.log(`❌ Failed: ${result.error}`);
        }
    }
}

// In a real environment we would use npx ts-node, but here we can just simulate or check URL construction
// Since generateImage in lib/pollinations.ts only constructs a URL, we can verify it easily.

testModels().catch(console.error);
