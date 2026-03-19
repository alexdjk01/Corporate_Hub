"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";


export default function Home() {
  redirect("/dashboard");
}