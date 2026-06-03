/**
 * Mock streaming API for testing without a backend
 * Simulates SSE (Server-Sent Events) streaming responses
 */

/**
 * Simulate streaming response with mock data
 * @param {string} question - The question to answer
 * @returns {Promise<Response>} - Mock fetch response with readable stream
 */
export async function mockStreamingAPI(question) {
  // Mock response based on question content
  const mockResponses = {
    'what is this': {
      text: 'This is a digitized manuscript from the Stanford Digital Repository. It contains historical documents and images that have been carefully preserved and made accessible through IIIF standards.',
      evidence: [
        {
          id: 'anno-001',
          canvas_id: 'canvas-1',
          canvas_label: 'Page 1',
          content: 'Historical manuscript dated 1850, containing correspondence and official documents.',
          relevance_score: 0.95,
        },
        {
          id: 'anno-002',
          canvas_id: 'canvas-2',
          canvas_label: 'Page 2',
          content: 'Handwritten notes describing the historical context and significance of these documents.',
          relevance_score: 0.88,
        },
      ],
    },
    'who': {
      text: 'The document mentions several historical figures including government officials, scholars, and community leaders from the mid-19th century.',
      evidence: [
        {
          id: 'anno-003',
          canvas_id: 'canvas-3',
          canvas_label: 'Page 3',
          content: 'Reference to Governor John Smith and his correspondence with local authorities.',
          relevance_score: 0.92,
        },
      ],
    },
    'summarize': {
      text: 'The main themes include governance, social reform, and cultural preservation during a period of significant historical change. The documents reflect the concerns and priorities of their time.',
      evidence: [
        {
          id: 'anno-004',
          canvas_id: 'canvas-1',
          canvas_label: 'Page 1',
          content: 'Discussion of educational reforms and their impact on society.',
          relevance_score: 0.85,
        },
      ],
    },
    'default': {
      text: 'Based on the manifest content, I can provide information about the historical documents, their context, and significance. The collection includes valuable primary sources from the 19th century.',
      evidence: [
        {
          id: 'anno-005',
          canvas_id: 'canvas-1',
          canvas_label: 'Page 1',
          content: 'General overview of the document collection and its historical importance.',
          relevance_score: 0.80,
        },
      ],
    },
  };

  // Find matching response
  let responseData = mockResponses.default;
  const lowerQuestion = question.toLowerCase();
  
  for (const [key, value] of Object.entries(mockResponses)) {
    if (key !== 'default' && lowerQuestion.includes(key)) {
      responseData = value;
      break;
    }
  }

  // Create a readable stream that simulates SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send start event
      controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));
      await sleep(100);

      // Stream text character by character (in chunks for realism)
      const text = responseData.text;
      const chunkSize = 5; // Send 5 characters at a time
      
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        const event = JSON.stringify({
          type: 'text_chunk',
          content: chunk,
        });
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        await sleep(50); // Simulate typing speed
      }

      // Send evidence
      await sleep(200);
      const evidenceEvent = JSON.stringify({
        type: 'evidence',
        evidence: responseData.evidence,
      });
      controller.enqueue(encoder.encode(`data: ${evidenceEvent}\n\n`));
      await sleep(100);

      // Send done signal
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  // Return a mock Response object
  return new Response(stream, {
    ok: true,
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  });
}

/**
 * Helper function to simulate delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
