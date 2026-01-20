'use client'

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function DialogWithInlineSearch() {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [showOptions, setShowOptions] = React.useState(false)
  const [selected, setSelected] = React.useState("")

  // قائمة الخيارات (يمكن لاحقاً استبدالها بجلب من Firestore)
  const options = [
    "شركة الهدى",
    "شركة الريان",
    "شركة الأفق",
    "مؤسسة النور",
    "مكتب الرؤية",
  ]

  // فلترة حسب النص المكتوب
  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  )

  // عند الاختيار
  function handleSelect(value: string) {
    setSelected(value)
    setSearch(value)
    setShowOptions(false)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>فتح النموذج</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>اختيار عميل</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <label className="block text-sm font-semibold">العميل</label>

            {/* حقل البحث والقائمة المنسدلة */}
            <div className="relative">
              <Input
                value={search}
                placeholder="ابحث عن عميل..."
                onFocus={() => setShowOptions(true)}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setShowOptions(true)
                }}
              />

              {showOptions && (
                <ul
                  className={cn(
                    "absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md"
                  )}
                >
                  {filtered.length === 0 && (
                    <li className="p-2 text-sm text-muted-foreground">
                      لا توجد نتائج
                    </li>
                  )}
                  {filtered.map((opt) => (
                    <li
                      key={opt}
                      className="cursor-pointer p-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault() // يمنع فقدان الفوكس أو إغلاق Dialog
                        handleSelect(opt)
                      }}
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => alert(`تم اختيار: ${selected}`)}>
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}