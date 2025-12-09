import { GoogleGenAI } from "@google/genai";

console.log("✅ Gemini API Key:", process.env.GEMINI_API_KEY);

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getRecyclingAdvice = async (query: string): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `Bạn là EcoBot, một trợ lý AI chuyên gia về tái chế và quản lý chất thải. 
    Nhiệm vụ của bạn là giúp người dùng phân loại rác chính xác, đưa ra lời khuyên về sống xanh và giải thích các quy trình xử lý rác thải.
    Hãy trả lời ngắn gọn, thân thiện, dùng biểu tượng cảm xúc (emoji) để sinh động. 
    Nếu người dùng hỏi về rác thải nguy hại hoặc điện tử, hãy cảnh báo họ cẩn thận.
    Ngôn ngữ: Tiếng Việt.`;

    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for faster simple responses
      }
    });

    return response.text || "Xin lỗi, tôi không thể xử lý yêu cầu lúc này.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Đã xảy ra lỗi khi kết nối với trợ lý AI. Vui lòng kiểm tra lại kết nối mạng hoặc API Key.";
  }
};
