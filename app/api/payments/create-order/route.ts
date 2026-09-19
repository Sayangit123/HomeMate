import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const amount = Number(body.amount);

        if (!amount || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment amount",
                },
                {
                    status: 400,
                }
            );
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `homemate_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            success: true,
            order,
        });
    } catch (error) {
        console.error("Razorpay order creation error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create Razorpay order",
            },
            {
                status: 500,
            }
        );
    }
}