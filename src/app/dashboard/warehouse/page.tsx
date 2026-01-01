import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { inventory } from '@/lib/data';
import { Progress } from '@/components/ui/progress';

export default function WarehousePage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Warehouse & Inventory</CardTitle>
                <CardDescription>
                    Track stock levels of all construction materials.
                </CardDescription>
            </div>
            <Button asChild size="sm" className="gap-1">
                <Link href="#">
                    <PlusCircle className="h-4 w-4" />
                    Add Material
                </Link>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="w-[300px]">Stock Level</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => {
              const stockPercentage = (item.quantity / (item.lowStockThreshold * 2)) * 100;
              const isLowStock = item.quantity <= item.lowStockThreshold;

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.supplier}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Progress value={stockPercentage} className="h-2" />
                        {isLowStock && <Badge variant="destructive">Low Stock</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.quantity} {item.unit}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
