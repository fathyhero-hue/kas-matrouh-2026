"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ShopSectionProps {
  productsList: any[];
  addToCart: (product: any) => void;
}

export const ShopSection = ({ productsList, addToCart }: ShopSectionProps) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 mt-4">
      {/* هيدر المتجر بنفس الألوان والتصميم بالظبط */}
      <div className="bg-[#13213a] border border-yellow-400/30 rounded-3xl p-6 shadow-xl text-center md:text-right">
        <h2 className="text-3xl font-black text-yellow-400 mb-2">🛒 متجر هيرو سبورت الرياضي</h2>
        <p className="text-cyan-300 font-bold">اختر التيشرتات والجوائز المخصصة لفريقك مع الدفع السريع والآمن.</p>
      </div>

      {/* شبكة عرض المنتجات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {productsList.length > 0 ? (
            productsList.map((product) => (
              <Card key={product.id} className="bg-[#13213a] border-yellow-400/20 rounded-3xl overflow-hidden shadow-xl hover:border-yellow-400 transition-colors">
                <div className="aspect-square bg-[#0a1428] overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">🛍️</div>
                  )}
                </div>
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-xl font-black text-white truncate">{product.title}</h3>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-yellow-400 text-black font-black text-lg px-3 py-1">
                      {Number(product.price || 0).toLocaleString("ar-EG")} ج.م
                    </Badge>
                  </div>
                  <Button onClick={() => addToCart(product)} className="w-full bg-yellow-400 text-black font-black rounded-2xl py-6 mt-2">
                    إضافة للسلة 🛒
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-[#13213a] border border-yellow-400/20 rounded-3xl text-white font-black text-xl">
              لا توجد منتجات معروضة للبيع حالياً.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};