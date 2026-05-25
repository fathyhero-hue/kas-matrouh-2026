"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Lock, Loader2, Upload, Camera } from "lucide-react";

interface RostersSectionProps {
  rosterViewMode: 'list' | 'register';
  setRosterViewMode: (mode: 'list' | 'register') => void;
  selectedRosterToView: any;
  setSelectedRosterToView: (roster: any) => void;
  activeTeamsList: string[];
  rostersList: any[];
  cupEdition: string;
  unlockedRoster: string | null;
  showPaymentForm: boolean;
  setShowPaymentForm: (show: boolean) => void;
  paymentForm: any;
  setPaymentForm: React.Dispatch<React.SetStateAction<any>>;
  rosterAccessPassword: string;
  setRosterAccessPassword: (pass: string) => void;
  rosterForm: any;
  setRosterForm: React.Dispatch<React.SetStateAction<any>>;
  isInitiatingPay: boolean;
  isUploading: boolean;
  handleInitiatePayment: () => void;
  handleRosterLogin: () => void;
  updateRosterPlayer: (index: number, field: string, value: string) => void;
  handlePlayerImageUpload: (index: number, field: 'personalImage' | 'idImage', file?: File) => void;
  submitFinalRoster: () => void;
  normalizeTeamName: (name: string) => string;
}

export default function RostersSection({
  rosterViewMode, setRosterViewMode, selectedRosterToView, setSelectedRosterToView,
  activeTeamsList, rostersList, cupEdition, unlockedRoster, showPaymentForm, setShowPaymentForm,
  paymentForm, setPaymentForm, rosterAccessPassword, setRosterAccessPassword,
  rosterForm, setRosterForm, isInitiatingPay, isUploading, handleInitiatePayment,
  handleRosterLogin, updateRosterPlayer, handlePlayerImageUpload, submitFinalRoster, normalizeTeamName
}: RostersSectionProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-center mb-6">
         <div className="bg-[#13213a] p-1.5 rounded-2xl border border-white/10 inline-flex shadow-lg gap-1 w-full max-w-md">
           <button onClick={() => { setRosterViewMode('list'); setSelectedRosterToView(null); }} className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${rosterViewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}><ClipboardList className="inline-block mr-1 h-5 w-5" /> عرض القوائم المشاركة</button>
           {cupEdition === 'edition_4' && (
              <button onClick={() => { setRosterViewMode('register'); setShowPaymentForm(true); }} className={`flex-1 py-3 rounded-xl text-base font-bold transition-all ${rosterViewMode === 'register' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}><Lock className="inline-block mr-1 h-5 w-5" /> تسجيل فريق جديد</button>
           )}
         </div>
      </div>

      {rosterViewMode === 'list' && !selectedRosterToView && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeTeamsList.map(teamName => {
                 const rosterData = rostersList.find(r => r.id === teamName); const isSubmitted = rosterData && rosterData.isSubmitted;
                 return (
                   <Card key={teamName} onClick={() => isSubmitted && setSelectedRosterToView(rosterData)} className={`border transition-all cursor-pointer overflow-hidden ${isSubmitted ? 'bg-[#1e2a4a] border-blue-500/50 hover:scale-105' : 'bg-[#13213a] border-white/5 opacity-55'}`}>
                      <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                         <span className="text-blue-400 text-3xl">🛡️</span>
                         <span className="font-black text-white text-lg">{teamName}</span>
                         <Badge className={isSubmitted ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-gray-800 text-gray-400"}>{isSubmitted ? "قائمة معتمدة" : "لم تسجل بعد"}</Badge>
                      </CardContent>
                   </Card>
                 );
              })}
        </div>
      )}

      {rosterViewMode === 'list' && selectedRosterToView && (
         <div className="max-w-4xl mx-auto">
           <Button onClick={() => setSelectedRosterToView(null)} variant="outline" className="mb-4 text-white font-bold">العودة للقوائم ↩</Button>
           <Card className="bg-[#1e2a4a] border border-blue-500/50 rounded-3xl shadow-2xl overflow-hidden">
              <CardHeader className="text-center py-6 border-b border-white/5">
                 <CardTitle className="text-3xl font-black text-white">{selectedRosterToView.teamName}</CardTitle>
                 <p className="mt-2 text-cyan-300 font-bold">مسئول الفريق: {selectedRosterToView.managerName} | تليفون: {selectedRosterToView.managerPhone}</p>
              </CardHeader>
              <CardContent className="p-0">
                 <table className="w-full text-right text-white"><thead className="bg-[#0a1428]"><tr><th className="p-4 text-center text-cyan-400">الرقم</th><th className="p-4 text-cyan-400">اسم اللاعب</th><th className="p-4 text-center text-cyan-400">الصورة والبطاقة</th></tr></thead>
                    <tbody>
                       {selectedRosterToView.players.map((p: any, i: number) => (
                         <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                           <td className="p-4 text-center font-black text-yellow-400 text-xl">{p.number}</td><td className="p-4 font-bold">{p.name}</td>
                           <td className="p-4 flex justify-center gap-3">{p.personalImage && <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20"><img src={p.personalImage} className="w-full h-full object-cover" alt="Player"/></div>}{p.idImage && <div className="w-14 h-10 rounded overflow-hidden border border-white/20"><img src={p.idImage} className="w-full h-full object-cover" alt="ID"/></div>}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </CardContent>
           </Card>
         </div>
      )}

      {rosterViewMode === 'register' && !unlockedRoster && (
         <Card className="max-w-xl mx-auto bg-[#13213a] border border-emerald-500/30 rounded-3xl shadow-2xl">
           <CardHeader className="text-center pb-6 border-b border-white/5"><span className="text-emerald-400 text-4xl block">🔒</span><CardTitle className="text-2xl font-black text-white mt-4">تسجيل وبوابة الدفع الإلكتروني</CardTitle></CardHeader>
           <CardContent className="p-8 space-y-6">
              {showPaymentForm ? (
                <div className="space-y-4 animate-in fade-in">
                   <Input placeholder="الاسم الثلاثي للمسئول" value={paymentForm.managerName} onChange={e => setPaymentForm((p: any)=>({...p, managerName: e.target.value}))} className="bg-[#1e2a4a] border-emerald-500/50 text-white font-bold h-12" />
                   <Input type="email" placeholder="البريد الإلكتروني لارسال الباسورد" value={paymentForm.email} onChange={e => setPaymentForm((p: any)=>({...p, email: e.target.value}))} className="bg-[#1e2a4a] border-emerald-500/50 text-white font-bold h-12 text-right" dir="ltr" />
                   <Input type="tel" placeholder="رقم الموبايل (المسجل بمحفظة الكاش)" value={paymentForm.phone} onChange={e => setPaymentForm((p: any)=>({...p, phone: e.target.value}))} className="bg-[#1e2a4a] border-emerald-500/50 text-white font-bold h-12 text-right" dir="ltr" />
                   <Button onClick={handleInitiatePayment} disabled={isInitiatingPay} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-6 text-xl shadow-lg mt-4">{isInitiatingPay ? <Loader2 className="animate-spin h-5 w-5" /> : "دفع الاشتراك فودافون كاش 💳"}</Button>
                   <div className="text-center pt-2"><button onClick={() => setShowPaymentForm(false)} className="text-emerald-400 underline font-bold text-sm">لدي الرقم السري الفعلي؟ الدخول مباشرة</button></div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                   <Input type="password" value={rosterAccessPassword} onChange={e => setRosterAccessPassword(e.target.value)} placeholder="أدخل الرقم السري المستلم بعد الدفع" className="bg-[#1e2a4a] border-emerald-500/50 text-white font-black text-center h-14" />
                   <Button onClick={handleRosterLogin} className="w-full bg-emerald-500 text-white font-black py-6 text-xl">تحقق ودخول لاستمارة التسجيل 🔓</Button>
                   <div className="text-center pt-2"><button onClick={() => setShowPaymentForm(true)} className="text-gray-400 text-sm">العودة لبوابة الدفع المالي</button></div>
                </div>
              )}
           </CardContent>
         </Card>
      )}

      {rosterViewMode === 'register' && unlockedRoster && (
         <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <Card className="bg-[#13213a] border border-blue-500/30 rounded-3xl overflow-hidden shadow-2xl">
               <CardHeader className="bg-[#1e2a4a] border-b border-blue-500/20 py-6"><CardTitle className="text-3xl font-black text-white text-center flex items-center justify-center gap-2">📋 استمارة تسجيل وتسكين الفريق السحابية</CardTitle></CardHeader>
               <CardContent className="p-4 md:p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0a1428] p-6 rounded-2xl border border-white/5">
                     <div className="md:col-span-2"><label className="block text-yellow-300 font-bold mb-2 text-lg">اسم الفريق</label><Input placeholder="اكتب اسم فريقك بدقة..." value={rosterForm.teamName} onChange={e => setRosterForm((p: any) => ({...p, teamName: e.target.value}))} className="bg-[#1e2a4a] border-yellow-400/50 text-white font-black text-xl h-14" /></div>
                     <div><label className="block text-cyan-300 font-bold mb-2">اسم مسئول ومفوض الفريق</label><Input placeholder="الاسم ثلاثي" value={rosterForm.managerName} onChange={e => setRosterForm((p: any) => ({...p, managerName: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12" /></div>
                     <div><label className="block text-cyan-300 font-bold mb-2">رقم هاتف المسئول (الكاش)</label><Input type="tel" dir="ltr" placeholder="01xxxxxxxxx" value={rosterForm.managerPhone} onChange={e => setRosterForm((p: any) => ({...p, managerPhone: e.target.value}))} className="bg-[#1e2a4a] border-blue-500/40 text-white font-bold h-12 text-right" /></div>
                  </div>
                  <div className="space-y-4">
                        {rosterForm.players.map((player: any, index: number) => (
                           <div key={index} className="flex flex-col sm:flex-row gap-3 items-center bg-[#1e2a4a] p-3 rounded-2xl border border-white/5">
                              <Badge className="bg-[#0a1428] text-gray-400 font-black px-3 py-1.5 shrink-0">{index + 1}</Badge>
                              <Input placeholder="اسم اللاعب ثلاثي" value={player.name} onChange={e => updateRosterPlayer(index, 'name', e.target.value)} className="flex-1 bg-[#0a1428] border-none text-white font-bold h-12" />
                              <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs font-bold">الرقم:</span>
                                    <Input type="number" placeholder="00" value={player.number} onChange={e => updateRosterPlayer(index, 'number', e.target.value)} className="w-16 bg-[#0a1428] border-none text-yellow-400 font-black text-center h-12" />
                              </div>
                              <div className="flex gap-2">
                                    <label className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl cursor-pointer border ${player.personalImagePreview ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#0a1428] border-white/10'}`}>
                                       {player.personalImagePreview ? <img src={player.personalImagePreview} className="w-full h-full object-cover rounded-xl" alt="Preview"/> : <Upload className="w-4 h-4" />}
                                       <input type="file" accept="image/*" onChange={e => handlePlayerImageUpload(index, 'personalImage', e.target.files?.[0])} className="hidden" />
                                    </label>
                                    <label className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl cursor-pointer border ${player.idImagePreview ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#0a1428] border-white/10'}`}>
                                       {player.idImagePreview ? <img src={player.idImagePreview} className="w-full h-full object-cover rounded-xl" alt="ID Preview"/> : <Camera className="w-4 h-4" />}
                                       <input type="file" accept="image/*" onChange={e => handlePlayerImageUpload(index, 'idImage', e.target.files?.[0])} className="hidden" />
                                    </label>
                              </div>
                           </div>
                        ))}
                  </div>
                  <Button onClick={submitFinalRoster} disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-7 text-xl shadow-xl">{isUploading ? <><Loader2 className="animate-spin mr-2 h-6 w-6"/> جاري رفع الملفات السحابية بالتوازي...</> : "حفظ واعتماد قائمة الفريق نهائياً ✔️"}</Button>
               </CardContent>
            </Card>
         </div>
      )}
    </div>
  );
}