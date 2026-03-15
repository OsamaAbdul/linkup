import React, { FC, useState, useRef } from 'react';
import { X, Printer, Share2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import Logo from "@/assets/logo.jpeg";
import './Receipt.css';

interface ReceiptItem {
    title: string;
    quantity: number;
    price: number;
}

interface ReceiptProps {
    orderNumber?: string;
    date?: string;
    items: ReceiptItem[];
    total: number;
    shopName?: string;
    shopAddress?: string;
}

const Receipt: FC<ReceiptProps> = ({
    orderNumber = "#001234",
    date = new Date().toLocaleString(),
    items = [],
    total = 0,
    shopName = "Linkup Global",
    shopAddress = "Local Commerce Center"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => window.print();

    const captureReceipt = async (): Promise<HTMLCanvasElement | null> => {
        if (!receiptRef.current) return null;
        setIsCapturing(true);
        try {
            return await html2canvas(receiptRef.current, {
                backgroundColor: '#f5f5f5',
                scale: 2,
                useCORS: true,
                logging: false,
            });
        } catch {
            return null;
        } finally {
            setIsCapturing(false);
        }
    };

    const handleDownloadImage = async () => {
        const canvas = await captureReceipt();
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `receipt-${orderNumber.replace('#', '')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const handleShare = async () => {
        const canvas = await captureReceipt();
        if (!canvas) return;
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `receipt-${orderNumber.replace('#', '')}.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ title: `Order Receipt ${orderNumber}`, files: [file] });
                } catch {
                    handleDownloadImage();
                }
            } else {
                handleDownloadImage();
            }
        }, 'image/png');
    };

    return (
        <div className={`receipt-container flex flex-col items-center ${isOpen ? 'is-open py-6' : 'py-2'}`}>

            {/* Toggle button — always visible */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold border border-black/15 rounded-full hover:bg-black/5 transition-all shadow-sm"
            >
                <Printer size={13} />
                {isOpen ? 'Hide Receipt' : 'View Receipt'}
            </button>

            {/* Full receipt — only when open */}
            {isOpen && (
                <>
                    {/* Printer animation */}
                    <div className="receipt-wrapper mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="printer" />
                        <div className="printer-display">
                            <div className="letter-wrapper flex">
                                {'Printing...'.split('').map((char, i) => (
                                    <span key={i} className="letter">{char}</span>
                                ))}
                            </div>
                        </div>

                        {/* Receipt paper */}
                        <div className="receipt-content-wrapper">
                            <div className="receipt relative" ref={receiptRef}>
                                {/* Close button */}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="absolute -top-3 -right-3 h-7 w-7 bg-black text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50"
                                >
                                    <X size={12} />
                                </button>

                                {/* Header */}
                                <div className="receipt-header">
                                    <div className="flex flex-col">
                                        <span className="font-bold tracking-tight text-base text-black">{shopName}</span>
                                        <span className="text-[7px] uppercase tracking-widest font-semibold leading-tight text-black/50">{shopAddress}</span>
                                    </div>
                                    <img src={Logo} alt="Linkup" className="h-9 w-9 rounded-full object-cover grayscale opacity-70" />
                                </div>

                                {/* Order info */}
                                <div className="receipt-subheader pt-2 border-t border-dashed border-black/10">
                                    <div className="flex justify-between w-full text-[9px] font-bold">
                                        <span>ORDER NO.</span>
                                        <span>{orderNumber}</span>
                                    </div>
                                    <div className="text-[8px] opacity-50 mt-0.5">{date}</div>
                                </div>

                                {/* Items */}
                                <table className="receipt-table mt-3">
                                    <thead>
                                        <tr className="border-b border-black/10">
                                            <th className="text-left pb-1">Item</th>
                                            <th className="text-center pb-1">Qty</th>
                                            <th className="text-right pb-1">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="py-1 truncate max-w-[80px]">{item.title}</td>
                                                <td className="text-center py-1">{item.quantity}x</td>
                                                <td className="text-right py-1">₦{item.price.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr className="receipt-subtotal">
                                            <td colSpan={2} className="pt-2 text-black/60">Subtotal</td>
                                            <td className="text-right pt-2">₦{total.toLocaleString()}</td>
                                        </tr>
                                        <tr className="receipt-total border-t border-black/20">
                                            <td colSpan={2} className="font-black text-sm pt-1 uppercase">Total</td>
                                            <td className="text-right font-black text-sm pt-1">₦{total.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Barcode */}
                                <div className="barcode mt-4">
                                    <div className="barcode-lines"></div>
                                    <div className="barcode-number">*{orderNumber.replace('#', '')}*</div>
                                </div>

                                <div className="receipt-message mt-3 italic opacity-60 text-center text-[8px]">
                                    Thank you for your purchase!
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons — OUTSIDE receipt-wrapper, in normal document flow */}
                    <div className="mt-4 flex items-center gap-2 w-full max-w-[290px] print:hidden">
                        <button
                            onClick={handleShare}
                            disabled={isCapturing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-full text-xs font-bold hover:bg-black/80 transition-all shadow-md disabled:opacity-50"
                        >
                            <Share2 size={13} />
                            {isCapturing ? 'Saving...' : 'Share'}
                        </button>
                        <button
                            onClick={handleDownloadImage}
                            disabled={isCapturing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-black/20 text-black rounded-full text-xs font-bold hover:bg-black/5 transition-all shadow-sm disabled:opacity-50"
                        >
                            <Download size={13} />
                            Save
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center justify-center px-3 py-2 border border-black/10 text-black/60 rounded-full text-xs font-semibold hover:bg-black/5 transition-all"
                            title="Print PDF"
                        >
                            <Printer size={13} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default Receipt;
