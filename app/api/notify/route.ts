import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

// تهيئة Firebase Admin للعمل في الخلفية بأمان
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "matrouh-cup",
      clientEmail: "firebase-adminsdk-fbsvc@matrouh-cup.iam.gserviceaccount.com",
      // معالجة المفتاح الخاص عشان يشتغل سليم على السيرفر
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCSEsdVGJZM/vfT\nPQjkwQHqpm4jCsuIhAJ9yJ7PCmKZRpilkW+nlR+3AM0yAXbwS0PdEmJlvfpJ66hV\nmqs6oECwqHDnHASRLjnnu8jYd1MoAAGtg3ATlud+J/k24VEIrY2aWn8apcACP5UP\nzyLlMqs3tKOegZ1IVvKrBzKGaVOpAF+YxNvPME31FbZDx+pRQ25NArTxs/YLvcZt\nEcKp/Szaj/r2yn2ID21hu21WiNDURCZRYqY5ITWWXcEf22HipB9uE3rqAx0/Po/z\nVXPvXNpiEqKyUYmKv5ANSfcIItBEbL/U5YFJ/Mfo9+OmYHZN6/a0akg1t8p0xAvp\n23RL/B/RAgMBAAECggEAA8LfBhZpfFcOW46VRYqguYGKkXVsMzou9D0vtaYPTuIN\n+SlrBhYlaGlpXzHBdcOCXlVkWjlPkgqy3W1rnklVERdtPM4wYeqeTBS+QbCk4AFM\nCcM6Jg77K/jshli75OzPGhvdbPq6nHQ1quALBnrNBNSuZ9zvh1bRzcyUJPjeUhop\n5pQJoozNiNnY9uErcnF+Q7dbRk2khBp6jJkgrzon3X6lAoht9KBCSgRceMCQ5hCJ\nsIVjKhH+iygjehV4Dd+Lg7o+kC+u7tm2iurqEP7LPzLp2b+zL68CBqYumiVOvYsd\ns1qOMQ/niTVRp5Og0yDUZi9tNEudWzUpQqxVOs0IYQKBgQDBv/v+6O363zSiJy5U\nVOAwwsDohhxMbZcaOcq/BwDGInaWaYuEZNBZo034/EiFFkC/rWhWopHS/XGh1pAN\nAPDywh73qqa7RQvA4X3R4fHiNymdjQEotbp5sPRf+HX8TaMKyK19LdLGm9VdKPKz\nsC/fgnPxfc4qlKGa7Ye5x+a5GQKBgQDBAV/ta/7Ntu46nCmUOWGxG0R0aGtRD7O7\n49VrzaOQkQi0ZZWscWrH2aK0R0hQMptyAmbTpxJdMF7xDwxahMQurakSY/W8sOdG\n0efeJAr65j1vipGLen/IqiB0po7iPywgOyHcRRwIkOR/1LD62/xVPV3RQuaRQ1ia\nurN35dEbeQKBgCyuo+Tzvv5eP3st4gdc058rKuX1F82gcHqB3XoUmV8YT5T8nkpY\nHZyuhqrnM6pNqX0K9scUEuE/xdb27p2xG+BAWHfxiSYjFETVO/kNTIVJB3XoMN48\nmta5soH3gO5A0VsJUMlPqg5XneswKFi8Ry4anbaRttwnDuX15Zk4usLxAoGBAL9D\nDn3oZJQVcNUyBd42UwJAZED7bUXiSpmqeMeg/DL6Fuc2N/GwX0H3AU6nyRh4XiTI\nDoA183PXyG4YHITjRsp/G6n21wGLSVWcE6vGif8DBOSxK/RNi64eMZWHrNa2BZNX\nJgHzlolClL281zlxoQgTjRIfuv8+/uIunET3wJX5AoGAcj6PIqYwr571oyFwq57Y\nZy8dIv/LUweppgakTP8Y5XwAz3jYcnpxEeiZxjI7DXRL1qVpZWTEaX6+V43oDZP0\nn+ZyAwIJrfzpaoK4Eizen9fZkzUnFQ2x8JFP4CXXruUT08IdeX4SH6c03VuKfyUk\nNjD1XZMSWLVdprKYmKXRVJ0=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, body: notificationBody, tokens } = body;

    // التأكد إن فيه رسالة وفيه ناس مشتركة
    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: "لا يوجد مشتركين للإرسال إليهم" }, { status: 400 });
    }

    // تجهيز شكل الإشعار
    const message = {
      notification: {
        title: title,
        body: notificationBody,
      },
      tokens: tokens, // الأكواد بتاعت كل الموبايلات المشتركة
    };

    // إرسال الإشعار للجميع في نفس اللحظة
    const response = await admin.messaging().sendEachForMulticast(message);
    
    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}