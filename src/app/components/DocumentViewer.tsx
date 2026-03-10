import { X, Printer, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type DocumentType = 'invoice' | 'delivery_note' | 'receipt' | 'purchase_order';

export interface DocumentData {
  id: string;
  type: DocumentType;
  orderNumber: string;
  issueDate: string;
  items: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  deliveryDate: string;
  farmerInfo: {
    name: string;
    address?: string;
    phone?: string;
  };
  restaurantInfo: {
    name: string;
    address?: string;
    phone?: string;
  };
  notes?: string;
  paymentDueDate?: string;
  paymentStatus?: 'unpaid' | 'paid';
  paidDate?: string;
}

interface DocumentViewerProps {
  document: DocumentData;
  onClose: () => void;
}

const documentTitles: Record<DocumentType, string> = {
  purchase_order: '注文書',
  delivery_note: '納品書',
  invoice: '請求書',
  receipt: '領収書',
};

const documentIssuers: Record<DocumentType, { label: string; style: string }> = {
  purchase_order: { label: '飲食店発行', style: 'bg-black text-white' },
  delivery_note: { label: '農家発行', style: 'bg-gray-200 text-gray-700' },
  invoice: { label: '農家発行', style: 'bg-gray-200 text-gray-700' },
  receipt: { label: '農家発行', style: 'bg-gray-200 text-gray-700' },
};

export function DocumentViewer({ document: documentData, onClose }: DocumentViewerProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!documentRef.current) return;
    
    setIsDownloading(true);
    try {
      // 見本デザインに合わせたHTMLを生成
      const container = window.document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px'; // A4 width at 96dpi
      container.style.backgroundColor = '#ffffff';
      container.style.color = '#000000';
      container.style.borderColor = '#000000';
      // oklch() を継承させないよう CSS 変数を全てリセット
      container.style.setProperty('--background', '#ffffff');
      container.style.setProperty('--foreground', '#000000');
      container.style.setProperty('--border', '#000000');
      container.style.setProperty('color-scheme', 'light');
      container.style.fontFamily = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';
      container.classList.add('pdf-render-root');
      window.document.body.appendChild(container);

      const title = documentTitles[documentData.type];
      const isInvoice = documentData.type === 'invoice';
      const isReceipt = documentData.type === 'receipt';
      const isDeliveryNote = documentData.type === 'delivery_note';
      const isPurchaseOrder = documentData.type === 'purchase_order';

      // 宛先・発行元の情報を書類タイプに応じて設定
      const recipientInfo = isPurchaseOrder ? documentData.farmerInfo : documentData.restaurantInfo;
      const issuerInfo = isPurchaseOrder ? documentData.restaurantInfo : documentData.farmerInfo;

      const issueDate = new Date(documentData.issueDate);
      const issueDateStr = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}-${String(issueDate.getDate()).padStart(2, '0')}`;

      const deliveryDate = new Date(documentData.deliveryDate);
      const deliveryDateStr = `${deliveryDate.getFullYear()}-${String(deliveryDate.getMonth() + 1).padStart(2, '0')}-${String(deliveryDate.getDate()).padStart(2, '0')}`;

      let paymentDueDateStr = '';
      if (documentData.paymentDueDate) {
        const pd = new Date(documentData.paymentDueDate);
        paymentDueDateStr = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(pd.getDate()).padStart(2, '0')}`;
      }

      // 税率計算（簡易: 全品10%として計算）
      const subtotal = documentData.subtotal;
      const tax = documentData.tax;
      const total = documentData.total;

      // 件名を生成
      const subjectName = documentData.orderNumber
        ? `注文 ${documentData.orderNumber}`
        : `${deliveryDateStr} 納品分`;

      // 明細行HTML生成
      const itemRowsHtml = documentData.items.map(item => `
        <tr>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:center;white-space:nowrap;">${deliveryDateStr}</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">${item.name}</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:right;white-space:nowrap;">${item.quantity} ${item.unit}</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:right;white-space:nowrap;">${item.unitPrice.toLocaleString()}</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;text-align:right;white-space:nowrap;">${item.amount.toLocaleString()}</td>
        </tr>
      `).join('');

      // 空行を追加して最低8行にする
      const emptyRowCount = Math.max(0, 8 - documentData.items.length);
      const emptyRowsHtml = Array(emptyRowCount).fill(`
        <tr>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">&nbsp;</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">&nbsp;</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">&nbsp;</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">&nbsp;</td>
          <td style="border:1px solid #000;padding:6px 10px;font-size:11px;">&nbsp;</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="padding:50px 50px 40px 50px;box-sizing:border-box;width:794px;min-height:1123px;position:relative;background:#fff;">
          <!-- タイトル -->
          <div style="text-align:center;margin-bottom:30px;">
            <span style="font-size:24px;font-weight:bold;border-bottom:3px solid #000;padding-bottom:4px;letter-spacing:8px;">${title}</span>
          </div>

          <!-- 上部: 宛先（左）+ 日付・番号（右） -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div style="flex:1;">
              <div style="font-size:16px;font-weight:bold;margin-bottom:6px;">${recipientInfo.name}　御中</div>
              ${recipientInfo.address ? `<div style="font-size:10px;color:#333;line-height:1.6;">${recipientInfo.address}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <table style="margin-left:auto;border-collapse:collapse;">
                <tr>
                  <td style="font-size:11px;padding:2px 12px 2px 0;color:#333;">${isInvoice ? '請求日' : isPurchaseOrder ? '注文日' : isDeliveryNote ? '納品日' : '発行日'}</td>
                  <td style="font-size:11px;padding:2px 0;font-weight:bold;">${issueDateStr}</td>
                </tr>
                <tr>
                  <td style="font-size:11px;padding:2px 12px 2px 0;color:#333;">${isInvoice ? '請求書番号' : isPurchaseOrder ? '注文書番号' : isDeliveryNote ? '納品書番号' : '領収書番号'}</td>
                  <td style="font-size:11px;padding:2px 0;font-weight:bold;">${documentData.id}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- 発行者名（右寄せ） -->
          <div style="text-align:right;margin-bottom:24px;margin-top:16px;">
            <span style="font-size:12px;">${issuerInfo.name}</span>
          </div>

          <!-- 件名 -->
          <div style="margin-bottom:12px;">
            <span style="font-size:11px;margin-right:12px;">件名</span>
            <span style="font-size:14px;font-weight:bold;">${subjectName}</span>
          </div>

          <!-- 合計サマリー表 -->
          <table style="border-collapse:collapse;margin-bottom:12px;">
            <tr>
              <td style="border:1px solid #000;padding:4px 16px;font-size:10px;font-weight:bold;background:#fff;text-align:center;">小計</td>
              <td style="border:1px solid #000;padding:4px 16px;font-size:10px;font-weight:bold;background:#fff;text-align:center;">消費税</td>
              <td style="border:1px solid #000;padding:4px 16px;font-size:10px;font-weight:bold;background:#fff;text-align:center;">${isInvoice ? '請求金額' : '合計金額'}</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:6px 16px;font-size:11px;text-align:center;">${subtotal.toLocaleString()}円</td>
              <td style="border:1px solid #000;padding:6px 16px;font-size:11px;text-align:center;">${tax.toLocaleString()}円</td>
              <td style="border:1px solid #000;padding:6px 16px;font-size:20px;font-weight:bold;text-align:center;">${total.toLocaleString()}円</td>
            </tr>
          </table>

          <!-- 入金期日・振込先 -->
          ${isInvoice ? `
          <table style="border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="border:1px solid #000;padding:4px 16px;font-size:10px;font-weight:bold;background:#fff;text-align:center;width:120px;">入金期日</td>
              <td style="border:1px solid #000;padding:4px 16px;font-size:10px;font-weight:bold;background:#fff;text-align:center;">振込先</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:6px 16px;font-size:11px;text-align:center;">${paymentDueDateStr || '—'}</td>
              <td style="border:1px solid #000;padding:6px 16px;font-size:11px;"></td>
            </tr>
          </table>
          ` : '<div style="margin-bottom:20px;"></div>'}

          <!-- 明細表 -->
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px;">
            <thead>
              <tr>
                <th style="border:1px solid #000;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;width:90px;">取引日</th>
                <th style="border:1px solid #000;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;">摘要</th>
                <th style="border:1px solid #000;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;width:80px;">数量</th>
                <th style="border:1px solid #000;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;width:80px;">単価</th>
                <th style="border:1px solid #000;padding:6px 10px;font-size:10px;font-weight:bold;text-align:center;width:90px;">明細金額</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
              ${emptyRowsHtml}
            </tbody>
          </table>

          <!-- 下部: 備考（左）+ 内訳（右） -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:auto;">
            <!-- 左: 備考 -->
            <div style="flex:1;margin-right:30px;">
              ${documentData.notes ? `
              <div style="border:1px solid #000;padding:10px 14px;font-size:10px;margin-top:8px;">
                <div style="font-weight:bold;margin-bottom:4px;font-size:10px;">備考</div>
                <div style="font-size:10px;line-height:1.6;white-space:pre-wrap;">${documentData.notes}</div>
              </div>
              ` : ''}
            </div>

            <!-- 右: 税率内訳 -->
            <div>
              <table style="border-collapse:collapse;">
                <tr>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:9px;font-weight:bold;">内訳</td>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:9px;">10%対象(税抜)</td>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:9px;text-align:right;">${subtotal.toLocaleString()}円</td>
                </tr>
                <tr>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:9px;"></td>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:8px;color:#555;">10%消費税</td>
                  <td style="border:1px solid #000;padding:3px 8px;font-size:8px;text-align:right;color:#555;">${tax.toLocaleString()}円</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- ページ番号 -->
          <div style="text-align:center;font-size:9px;color:#999;position:absolute;bottom:30px;left:0;right:0;">1 / 1</div>
        </div>
      `;

      // innerHTML設定後にスタイルを挿入（innerHTML で上書きされないように）
      // Tailwind v4 の oklch カスタムプロパティが html2canvas に渡らないよう隔離
      const isolationStyle = window.document.createElement('style');
      isolationStyle.textContent = `
        .pdf-render-root, .pdf-render-root * {
          color: #000 !important;
          border-color: #000 !important;
          background-color: transparent !important;
          --tw-border-opacity: 1 !important;
          --tw-text-opacity: 1 !important;
          --tw-bg-opacity: 1 !important;
        }
        .pdf-render-root {
          background-color: #fff !important;
        }
      `;
      container.prepend(isolationStyle);

      // :root の oklch CSS 変数を一時的に hex に上書き（html2canvas がパース可能な形式）
      const rootOverrideStyle = window.document.createElement('style');
      rootOverrideStyle.id = 'pdf-oklch-override';
      rootOverrideStyle.textContent = `
        :root {
          --foreground: #000 !important;
          --card-foreground: #000 !important;
          --popover: #fff !important;
          --popover-foreground: #000 !important;
          --primary-foreground: #fff !important;
          --secondary: #f0f0f2 !important;
          --ring: #aaa !important;
          --chart-1: #e0734a !important;
          --chart-2: #2a9d8f !important;
          --chart-3: #264653 !important;
          --chart-4: #e9c46a !important;
          --chart-5: #f4a261 !important;
          --sidebar: #fafafa !important;
          --sidebar-foreground: #000 !important;
          --sidebar-primary-foreground: #fafafa !important;
          --sidebar-accent: #f5f5f5 !important;
          --sidebar-accent-foreground: #333 !important;
          --sidebar-border: #e5e5e5 !important;
          --sidebar-ring: #aaa !important;
        }
      `;
      window.document.head.appendChild(rootOverrideStyle);

      // 少し待ってレンダリングを安定させる
      await new Promise(resolve => setTimeout(resolve, 200));

      const renderTarget = container.querySelector('div') as HTMLElement;

      const canvas = await html2canvas(renderTarget, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        width: 794,
        height: 1123,
      });

      // Clean up
      window.document.body.removeChild(container);
      window.document.head.removeChild(rootOverrideStyle);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = 297; // A4 height in mm

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${title}_${documentData.id}.pdf`);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      // エラー時もクリーンアップ
      const orphanOverride = window.document.getElementById('pdf-oklch-override');
      if (orphanOverride) orphanOverride.remove();
      const orphanContainer = window.document.querySelector('.pdf-render-root');
      if (orphanContainer) orphanContainer.remove();
      alert('PDFの生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        {/* ヘッダー（印刷時は非表示） */}
        <div className="sticky top-0 bg-white border-b-2 border-gray-300 px-4 py-3 print:hidden z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold text-black flex items-center gap-1.5 truncate">
                <FileText className="w-5 h-5 shrink-0" />
                {documentTitles[documentData.type]}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${documentIssuers[documentData.type].style}`}>
                {documentIssuers[documentData.type].label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border border-gray-300 rounded-lg text-xs h-8 px-3"
              >
                <Printer className="w-4 h-4" />
                印刷
              </Button>
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border border-gray-300 rounded-lg text-xs h-8 px-3"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? '生成中...' : 'PDF'}
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* 書類本体 */}
        <div className="p-6 sm:p-8 bg-white" ref={documentRef}>
          {/* 書類タイトル */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-black mb-1">
              {documentTitles[documentData.type]}
            </h1>
            <div className="text-xs text-gray-500">
              {documentData.type === 'invoice' && '下記の通りご請求申し上げます'}
              {documentData.type === 'delivery_note' && '下記の通り納品いたしました'}
              {documentData.type === 'receipt' && '下記の通り領収いたしました'}
              {documentData.type === 'purchase_order' && '下記の通り注文いたしました'}
            </div>
          </div>

          {/* 書類番号と日付 */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 pb-3 border-b-2 border-gray-300 gap-2">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">
                {documentData.type === 'invoice' && '請求書番号'}
                {documentData.type === 'delivery_note' && '納品書番号'}
                {documentData.type === 'receipt' && '領収書番号'}
                {documentData.type === 'purchase_order' && '注文書番号'}
              </div>
              <div className="text-base font-bold text-black">{documentData.id}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs text-gray-500 mb-0.5">発行日</div>
              <div className="text-base font-bold text-black">
                {new Date(documentData.issueDate).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* 宛先と発行元 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {documentData.type === 'purchase_order' ? (
              <>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                    発行元（飲食店）
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black text-white">発行者</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-base font-bold text-black mb-1">
                      {documentData.restaurantInfo.name}
                    </div>
                    {documentData.restaurantInfo.address && (
                      <div className="text-xs text-gray-600 mb-0.5">
                        {documentData.restaurantInfo.address}
                      </div>
                    )}
                    {documentData.restaurantInfo.phone && (
                      <div className="text-xs text-gray-600">
                        TEL: {documentData.restaurantInfo.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">宛先（農家）</div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-base font-bold text-black mb-1">
                      {documentData.farmerInfo.name} 御中
                    </div>
                    {documentData.farmerInfo.address && (
                      <div className="text-xs text-gray-600 mb-0.5">
                        {documentData.farmerInfo.address}
                      </div>
                    )}
                    {documentData.farmerInfo.phone && (
                      <div className="text-xs text-gray-600">
                        TEL: {documentData.farmerInfo.phone}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">宛先（飲食店）</div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-base font-bold text-black mb-1">
                      {documentData.restaurantInfo.name} 御中
                    </div>
                    {documentData.restaurantInfo.address && (
                      <div className="text-xs text-gray-600 mb-0.5">
                        {documentData.restaurantInfo.address}
                      </div>
                    )}
                    {documentData.restaurantInfo.phone && (
                      <div className="text-xs text-gray-600">
                        TEL: {documentData.restaurantInfo.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                    発行元（農家）
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-white">発行者</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="text-base font-bold text-black mb-1">
                      {documentData.farmerInfo.name}
                    </div>
                    {documentData.farmerInfo.address && (
                      <div className="text-xs text-gray-600 mb-0.5">
                        {documentData.farmerInfo.address}
                      </div>
                    )}
                    {documentData.farmerInfo.phone && (
                      <div className="text-xs text-gray-600">
                        TEL: {documentData.farmerInfo.phone}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 注文情報 */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500">注文番号: </span>
                <span className="text-sm font-bold text-black">{documentData.orderNumber}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">納品予定日: </span>
                <span className="text-sm font-bold text-black">
                  {new Date(documentData.deliveryDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {documentData.type === 'invoice' && documentData.paymentDueDate && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">お支払期日: </span>
                  <span className="text-sm font-bold text-black">
                    {new Date(documentData.paymentDueDate).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {documentData.type === 'receipt' && documentData.paidDate && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">受領日: </span>
                  <span className="text-sm font-bold text-black">
                    {new Date(documentData.paidDate).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 明細表 */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-y-2 border-gray-300">
                  <th className="text-left p-2.5 text-xs font-bold text-gray-700">品名</th>
                  <th className="text-center p-2.5 text-xs font-bold text-gray-700 w-20">数量</th>
                  <th className="text-right p-2.5 text-xs font-bold text-gray-700 w-24">単価</th>
                  <th className="text-right p-2.5 text-xs font-bold text-gray-700 w-28">金額</th>
                </tr>
              </thead>
              <tbody>
                {documentData.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="p-2.5 text-sm text-gray-800">{item.name}</td>
                    <td className="p-2.5 text-sm text-gray-800 text-center">
                      {item.quantity}
                      <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                    </td>
                    <td className="p-2.5 text-sm text-gray-800 text-right">
                      ¥{item.unitPrice.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-sm font-bold text-black text-right">
                      ¥{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 合計 */}
          <div className="ml-auto w-full sm:w-72 space-y-2 mb-6">
            <div className="flex justify-between items-center pb-2 border-b border-gray-300">
              <span className="text-sm text-gray-600">小計</span>
              <span className="text-base font-bold text-black">¥{documentData.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-gray-300">
              <span className="text-sm text-gray-600">消費税（10%）</span>
              <span className="text-base font-bold text-black">¥{documentData.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-1 pb-2 border-b-2 border-gray-800">
              <span className="text-base font-bold text-black">合計金額</span>
              <span className="text-2xl font-bold text-black">¥{documentData.total.toLocaleString()}</span>
            </div>
          </div>

          {/* 備考 */}
          {documentData.notes && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-500 mb-1.5 font-bold">備考</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{documentData.notes}</div>
            </div>
          )}

          {/* ステータス表示（領収書以外） */}
          {documentData.type === 'invoice' && documentData.paymentStatus && (
            <div className="text-center p-3 rounded-lg border-2 border-gray-300">
              <span className="text-sm text-gray-600 mr-2">お支払い状況:</span>
              <span
                className={`text-base font-bold ${
                  documentData.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'
                }`}
              >
                {documentData.paymentStatus === 'paid' ? '支払済' : '未払い'}
              </span>
            </div>
          )}

          {/* フッター */}
          <div className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
            本書面は「メグル」システムにより自動発行されました
          </div>
        </div>
      </div>
    </div>
  );
}