// src/pages/ContinuousBeamInput.jsx — renders inside MainLayout
// Thin wrapper around the shared ContinuousBeamForm component. The form body now lives in
// src/components/beam/ContinuousBeamForm.jsx so that BeamInput can embed it in-place via its
// beam-type toggle without duplicating the fields. Behaviour on this route is unchanged.
import React from "react";
import ContinuousBeamForm from "../components/beam/ContinuousBeamForm";

const ContinuousBeamInput = () => <ContinuousBeamForm showHeader />;

export default ContinuousBeamInput;
