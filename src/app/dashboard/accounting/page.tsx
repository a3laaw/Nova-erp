import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { clients, invoices } from '@/lib/data';
import { formatCurrency } from '@/lib/utils';
import type { InvoiceStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusStyles: Record<InvoiceStatus, string> = {
    'Paid': 'bg-green-100 text-green-800 border-green-200',
    'Sent': 'bg-blue-100 text-blue-800 border-blue-200',
    'Draft': 'bg-gray-100 text-gray-800 border-gray-200',
    'Overdue': 'bg-red-100 text-red-800 border-red-200',
};

export default function AccountingPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting</CardTitle>
        <CardDescription>
          Manage invoices, track income and expenses, and view financial reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="transactions">Income/Expense</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="mt-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map(invoice => {
                        const client = clients.find(c => c.id === invoice.clientId);
                        return (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                <TableCell>{client?.name}</TableCell>
                                <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                                <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn(statusStyles[invoice.status])}>{invoice.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(invoice.amount)}</TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">Transaction Log Coming Soon</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    A complete log of income and expenses will be available here.
                </p>
            </div>
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">Financial Reports Coming Soon</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Profit & Loss, Balance Sheet, and Cash Flow reports will be generated here.
                </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
