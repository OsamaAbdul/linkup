import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mail, Phone, MessageCircle, FileQuestion, Truck, CreditCard, ShieldCheck } from "lucide-react";

export default function Support() {
    return (
        <AppLayout>
            <div className="p-6 space-y-8 max-w-5xl mx-auto">
                {/* Header Section */}
                <div className="text-center space-y-4 py-8">
                    <h1 className="text-3xl font-bold text-foreground">How can we help you?</h1>
                    <div className="relative max-w-lg mx-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                        <Input
                            placeholder="Search for help..."
                            className="pl-10 h-12 bg-white shadow-sm border-muted-foreground/20 text-base"
                        />
                    </div>
                </div>

                {/* Quick Help Categories */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-border/50">
                        <CardHeader className="space-y-1">
                            <Truck className="h-8 w-8 text-blue-600 mb-2" />
                            <CardTitle className="text-lg">Orders & Delivery</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Track your order, cancel items, or report missing packages.</p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-border/50">
                        <CardHeader className="space-y-1">
                            <CreditCard className="h-8 w-8 text-green-600 mb-2" />
                            <CardTitle className="text-lg">Payments & Refunds</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Manage payment methods, request refunds, and view transaction history.</p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-border/50">
                        <CardHeader className="space-y-1">
                            <ShieldCheck className="h-8 w-8 text-amber-500 mb-2" />
                            <CardTitle className="text-lg">Trust & Safety</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Learn about Escrow protection, verified sellers, and account security.</p>
                        </CardContent>
                    </Card>
                </div>

                {/* FAQs */}
                <div className="bg-white rounded-xl border p-6 md:p-8">
                    <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>How do I track my order?</AccordionTrigger>
                            <AccordionContent>
                                You can track your order by going to the "My Orders" page. Click on the specific order you want to track, and you will see the current status and tracking details.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>What is Escrow Safe?</AccordionTrigger>
                            <AccordionContent>
                                Escrow Safe is our buyer protection program. When you pay, your money is held securely in an escrow account and is only released to the seller after you have confirmed receipt and satisfaction with your order.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger>How do I return an item?</AccordionTrigger>
                            <AccordionContent>
                                To return an item, go to "My Orders", select the completed order, and click "Request Return". Follow the instructions to print your return label. Returns are accepted within 3 days of delivery for eligible items.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-4">
                            <AccordionTrigger>Can I change my delivery address?</AccordionTrigger>
                            <AccordionContent>
                                You can change your delivery address for an order only if it hasn't been shipped yet. Go to your order details to check if the option is available. Otherwise, you can update your default address in your Profile settings.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                {/* Contact Options */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold">Still need help?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 flex flex-col items-center text-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Email Support</h3>
                                <p className="text-sm text-muted-foreground">Get a response within 24 hours</p>
                            </div>
                            <Button variant="outline" className="mt-2 w-full border-blue-200 text-blue-700 hover:bg-blue-100">Contact Us</Button>
                        </div>

                        <div className="bg-green-50/50 border border-green-100 rounded-xl p-6 flex flex-col items-center text-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <MessageCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Live Chat</h3>
                                <p className="text-sm text-muted-foreground">Chat with our support team instantly</p>
                            </div>
                            <Button variant="outline" className="mt-2 w-full border-green-200 text-green-700 hover:bg-green-100">Start Chat</Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

