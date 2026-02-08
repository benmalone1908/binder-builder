import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReferenceDataTab } from "@/components/admin/ReferenceDataTab";
import { CollectionsTab } from "@/components/admin/CollectionsTab";

export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage reference data for set creation
        </p>
      </div>

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="product_lines">Product Lines</TabsTrigger>
          <TabsTrigger value="insert_sets">Insert Sets</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="mt-6">
          <ReferenceDataTab table="brands" title="Brands" />
        </TabsContent>

        <TabsContent value="product_lines" className="mt-6">
          <ReferenceDataTab table="product_lines" title="Product Lines" />
        </TabsContent>

        <TabsContent value="insert_sets" className="mt-6">
          <ReferenceDataTab table="insert_sets" title="Insert Sets" />
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <CollectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
