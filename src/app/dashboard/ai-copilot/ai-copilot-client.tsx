'use client';

import {
AlertCircle,
Bot,
Brain,
CheckCircle,
Loader2,
Send,
ShieldCheck,
Sparkles,
TrendingUp,
User,
XCircle
} from "lucide-react";
import { useEffect,useRef,useState } from "react";
import { toast,Toaster } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  report?: AiReport;
}

interface AiReport {
  status?: string;
  error?: string;
  analysis?: {
    executiveSummary?: string;
  };
  strategicRecommendations?: string[];
  draftActions?: DraftAction[];
}

interface DraftAction {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AICopilotClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Xin chào Tổng Giám Đốc! Tôi là AI COO - Thư ký điều phối vận hành tổng của Bella Spa. Tôi ở đây để hỗ trợ anh phân tích các chỉ số tài chính (Thông tư 133), chấm công & lương KTV, đối soát dòng tiền và đề xuất các quyết định cải tiến chiến lược tối ưu. Anh cần tôi kiểm tra mảng nào hôm nay?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvedActions, setApprovedActions] = useState<Record<string, boolean>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/ai/coo-orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: userMessage })
      });

      const data = (await response.json()) as AiReport;

      if (!response.ok) {
        throw new Error(data.error || "Lỗi xử lý của AI Orchestrator");
      }

      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: data.analysis?.executiveSummary || "AI COO đã hoàn tất phân tích nhưng chưa có tóm tắt điều hành.",
          report: data
        }
      ]);
      toast.success("AI COO đã hoàn tất phân tích số liệu!");

    } catch (error: unknown) {
      console.error("Lỗi gọi AI COO:", error);
      const message = getErrorMessage(error, "Không thể phân tích yêu cầu.");
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: `⚠️ Đã xảy ra lỗi nghiêm trọng: ${message}. Vui lòng thử lại hoặc liên hệ bộ phận kỹ thuật.`
        }
      ]);
      toast.error(`Lỗi phân tích: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (action: DraftAction, actionKey: string) => {
    if (approvingId === actionKey) return;
    
    setApprovingId(actionKey);
    const toastId = toast.loading(`Đang tiến hành duyệt hành động nháp cho ${action.recipient}...`);

    try {
      const response = await fetch("/api/v1/ai/action-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.type,
          recipient: action.recipient,
          reason: action.reason,
          draftMessage: action.draftMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lỗi phê duyệt từ hệ thống");
      }

      setApprovedActions(prev => ({ ...prev, [actionKey]: true }));
      toast.success(`Đã phê duyệt thành công đề xuất cho ${action.recipient}!`, { id: toastId });

    } catch (error: unknown) {
      console.error("Lỗi duyệt hành động:", error);
      toast.error(`Phê duyệt thất bại: ${getErrorMessage(error, "Không thể phê duyệt hành động.")}`, { id: toastId });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = (action: DraftAction, actionKey: string) => {
    toast.info(`Đã từ chối bản nháp đề xuất của ${action.recipient}`);
    setApprovedActions(prev => ({ ...prev, [actionKey]: false }));
  };

  return (
    <div className="flex-1 min-h-[calc(100vh-4rem)] lg:min-h-screen flex flex-col overflow-y-auto lg:overflow-hidden relative bg-background text-foreground">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

      <Toaster position="top-right" richColors />

      {/* Header Bar */}
      <header className="relative shrink-0 z-10 px-4 sm:px-6 py-4 border-b border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-primary via-accent to-rose-500 bg-clip-text text-transparent uppercase tracking-wider">AI COO Copilot</h1>
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-widest mt-0.5">Mức A • Trợ lý điều hành Tổng Giám Đốc</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">RLS Secured Tenant</span>
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden relative z-10 p-4 sm:p-6 gap-4 sm:gap-6 min-h-0">
        
        {/* Chat Area (Left 3/5) */}
        <div className="flex min-h-[32rem] flex-col bg-card/40 border border-border rounded-3xl lg:rounded-[2rem] overflow-hidden backdrop-blur-md shadow-lg lg:flex-1 lg:min-h-0">
          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar">
            {messages.map((msg, index) => (
              <div 
                key={index}
                className={`flex gap-3 sm:gap-4 max-w-[92%] sm:max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center shadow-md ${
                  msg.role === "user" 
                    ? "bg-accent text-accent-foreground" 
                    : "bg-primary text-white"
                }`}>
                  {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                <div className="min-w-0 space-y-4">
                  <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 border text-sm leading-relaxed shadow-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground border-primary/20 shadow-md" 
                      : "bg-card border-border text-foreground shadow-sm"
                  }`}>
                    {msg.content}
                  </div>

                  {/* Render analysis report details if present */}
                  {msg.report && msg.report.status === "success" && (
                    <div className="space-y-4">
                      {/* Strategic Recommendations Card */}
                      {msg.report.strategicRecommendations && msg.report.strategicRecommendations.length > 0 && (
                        <div className="bg-card/85 border border-border p-6 rounded-[2rem] shadow-sm space-y-3">
                          <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Đề xuất Cải tiến Chiến lược
                          </h4>
                          <ul className="space-y-2">
                            {msg.report.strategicRecommendations.map((r: string, rIdx: number) => (
                              <li key={rIdx} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary font-extrabold">{rIdx + 1}.</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 max-w-[80%] mr-auto">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-md">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-extrabold uppercase tracking-widest animate-pulse">AI COO đang thu thập dữ liệu và lập báo cáo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input */}
          <form 
            onSubmit={handleSend}
            className="shrink-0 p-3 sm:p-4 border-t border-border bg-card/60 flex items-center gap-2 sm:gap-3 relative z-10"
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Nhập yêu cầu (ví dụ: 'Đối soát quỹ', 'Tính lương KTV Hoa'...)"
              className="min-w-0 flex-1 bg-muted border border-border rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 bg-primary hover:bg-primary-hover text-white font-bold px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Action Board (Right 2/5) */}
        <div className="w-full lg:w-96 flex min-h-[24rem] lg:min-h-0 flex-col bg-card/40 border border-border rounded-3xl lg:rounded-[2rem] overflow-hidden backdrop-blur-md shadow-lg p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="shrink-0">
            <h3 className="text-sm font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Bảng Duyệt Hành Động (Mức A)
            </h3>
            <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider mt-1">Các quyết định khẩn cấp cần Tổng Giám Đốc xác nhận</p>
          </div>

          {/* List of draft actions */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {messages.filter(m => (m.report?.draftActions?.length ?? 0) > 0).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border text-muted-foreground shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground uppercase tracking-widest">Không có hành động chờ duyệt</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] mx-auto">Khi anh ra lệnh cho AI COO phân tích bất thường, các bản nháp giải trình hoặc đối soát sẽ xuất hiện tại đây.</p>
                </div>
              </div>
            ) : (
              messages.flatMap((m, mIdx) => 
                (m.report?.draftActions || []).map((action, actIdx) => {
                  const actionKey = `${mIdx}-${actIdx}-${action.recipient}`;
                  const isApproved = approvedActions[actionKey] === true;
                  const isRejected = approvedActions[actionKey] === false;

                  return (
                    <div 
                      key={actionKey}
                      className="bg-card border border-border p-5 rounded-2xl shadow-md space-y-4 hover:border-primary/20 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            action.type === "attendance_warning" 
                              ? "bg-pink-500/10 text-pink-500 border border-pink-500/20" 
                              : "bg-cyan-500/10 text-cyan-600 border border-cyan-500/20"
                          }`}>
                            {action.type === "attendance_warning" ? "Nhân sự - Kỷ luật" : "Kế toán - Đối soát"}
                          </span>
                          <h4 className="text-xs font-black text-foreground mt-2">Đối tượng: {action.recipient}</h4>
                        </div>

                        {isApproved && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Đã Duyệt
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Đã Từ Chối
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-foreground leading-relaxed font-semibold italic bg-muted/50 p-2.5 rounded-lg border border-border">
                        Lý do: {action.reason}
                      </p>

                      <div className="space-y-1.5">
                        <label className="text-[9px] text-muted-foreground font-extrabold uppercase tracking-wider block">Nội dung tin nhắn dự thảo:</label>
                        <div className="text-[11px] text-foreground leading-normal bg-muted p-3 rounded-lg border border-border break-words">
                          {action.draftMessage}
                        </div>
                      </div>

                      {!isApproved && !isRejected && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(action, actionKey)}
                            disabled={approvingId !== null}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {approvingId === actionKey ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" /> Duyệt gửi
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(action, actionKey)}
                            disabled={approvingId !== null}
                            className="bg-muted hover:bg-slate-100 border border-border text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Bỏ qua
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
