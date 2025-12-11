import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get("Stripe-Signature") as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (event.type === "checkout.session.completed") {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        )

        // Verificar que no sea una suscripción eliminada
        if ('deleted' in subscription && subscription.deleted) {
            return new NextResponse("Subscription is deleted", { status: 400 })
        }

        // Cast seguro o TS ya debería inferirlo
        const sub = subscription as Stripe.Subscription

        if (!session?.metadata?.organizationId) {
            return new NextResponse("Organization ID not found in metadata", { status: 400 })
        }

        await prisma.organization.update({
            where: {
                id: session.metadata.organizationId,
            },
            data: {
                stripeCustomerId: sub.customer as string,
                stripeSubscriptionId: sub.id,
                stripePriceId: sub.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(
                    (sub as any).current_period_end * 1000
                ),
            },
        })
    }

    if (event.type === "invoice.payment_succeeded") {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        )

        // Verificar que no sea una suscripción eliminada
        if ('deleted' in subscription && subscription.deleted) {
            return new NextResponse("Subscription is deleted", { status: 400 })
        }

        const sub = subscription as Stripe.Subscription

        await prisma.organization.update({
            where: {
                stripeSubscriptionId: sub.id,
            },
            data: {
                stripePriceId: sub.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(
                    (sub as any).current_period_end * 1000
                ),
            },
        })
    }

    return new NextResponse(null, { status: 200 })
}
