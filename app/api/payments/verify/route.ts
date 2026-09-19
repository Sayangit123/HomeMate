import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = body;

        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Missing Razorpay payment details",
                },
                {
                    status: 400,
                }
            );
        }

        const secret =
            process.env.RAZORPAY_KEY_SECRET;

        if (!secret) {
            console.error(
                "RAZORPAY_KEY_SECRET is missing"
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Razorpay server configuration is missing",
                },
                {
                    status: 500,
                }
            );
        }

        const generatedSignature =
            crypto
                .createHmac(
                    "sha256",
                    secret
                )
                .update(
                    `${razorpay_order_id}|${razorpay_payment_id}`
                )
                .digest("hex");

        const isValid =
            generatedSignature ===
            razorpay_signature;

        if (!isValid) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid payment signature",
                },
                {
                    status: 400,
                }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Payment verified successfully",
            paymentId:
                razorpay_payment_id,
            razorpayOrderId:
                razorpay_order_id,
        });
    } catch (error) {
        console.error(
            "Razorpay verification error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Payment verification failed",
            },
            {
                status: 500,
            }
        );
    }
}