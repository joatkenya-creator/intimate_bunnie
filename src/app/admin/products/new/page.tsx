import { requirePagePermission } from '@/lib/rbac'
import { editorOptions } from '@/server/product-editor'
import { PageHeader } from '@/components/admin/ui'
import { ProductEditor } from '@/components/admin/ProductEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New product' }

export default async function NewProductPage() {
  await requirePagePermission('products.write')
  const options = await editorOptions()

  return (
    <>
      <PageHeader title="New product" description="It saves as a draft unless you set the status to published." />
      <ProductEditor product={null} {...options} />
    </>
  )
}
