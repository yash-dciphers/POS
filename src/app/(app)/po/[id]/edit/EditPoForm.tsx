'use client';

import PoCreateForm, { type PoFormInitialValues } from '../../new/PoCreateForm';
import { updatePurchaseOrder } from './actions';

export default function EditPoForm({
  poId,
  defaultGstRate,
  initialValues,
  existingPoNumber,
}: {
  poId: string;
  defaultGstRate: number;
  initialValues: PoFormInitialValues;
  existingPoNumber: string;
}) {
  async function handleSubmitEdit(payload: any) {
    await updatePurchaseOrder({ ...payload, poId });
  }

  return (
    <PoCreateForm
      mode="edit"
      poId={poId}
      defaultGstRate={defaultGstRate}
      initialValues={initialValues}
      existingPoNumber={existingPoNumber}
      onSubmitEdit={handleSubmitEdit}
      isAdmin
    />
  );
}
