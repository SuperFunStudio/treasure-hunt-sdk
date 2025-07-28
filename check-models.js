import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function checkModels() {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Vision-capable models available to you:');
    console.log('=====================================');
    
    const visionModels = data.data.filter(model => 
      model.id.includes('gpt-4o') || 
      model.id.includes('gpt-4-vision') ||
      model.id.includes('gpt-4-turbo')
    );
    
    visionModels.forEach(model => {
      console.log(`- ${model.id}`);
    });

    if (visionModels.length === 0) {
      console.log('No vision-capable models found. Your API key may not have access to GPT-4 models.');
    }

  } catch (error) {
    console.error('Error checking models:', error.message);
  }
}

checkModels();