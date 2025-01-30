import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormData } from "@/lib/validation";

const immigrationFormSchema = z.object({
  mot: z.enum(["B", "U", "Z"], {
    required_error: "Mode of Transport is required",
  }),
  checkpoint: z.enum(["W", "H"], {
    required_error: "Checkpoint is required",
  }),
  arrivalDepartureDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, {
    message: "Date must be in DD/MM/YYYY format",
  }),
  arrivalDepartureTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, {
    message: "Time must be in HH:MM:SS format",
  }),
  userId: z.string().regex(/^[STFG]\d{7}[A-Z]$/, {
    message: "Invalid NRIC format",
  }),
  hostname: z.string().min(1, "Hostname is required"),
});

interface ImmigrationClearanceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
}

export default function ImmigrationClearanceModal({
  open,
  onClose,
  onSubmit,
}: ImmigrationClearanceModalProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mot: undefined,
      checkpoint: undefined,
      arrivalDepartureDate: "",
      arrivalDepartureTime: "",
      userId: "",
      hostname: "",
    },
  });

  const handleSubmit = (data: FormData) => {
    const [day, month, year] = data.arrivalDepartureDate.split("/");
    const [hours, minutes, seconds] = data.arrivalDepartureTime.split(":");
    const date = new Date(
      `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
    );

    onSubmit({
      ...data,
      arrivalDepartureDate: `${day}/${month}/${year}`,
      arrivalDepartureTime: `${hours}:${minutes}:${seconds}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Immigration Clearance</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] px-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="mot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode of Transport (MOT)</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select MOT" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="B">Bus Hall (B)</SelectItem>
                        <SelectItem value="U">Bus Lane (U)</SelectItem>
                        <SelectItem value="Z">Not Applicable (Z)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Checkpoint</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Checkpoint" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="W">Woodlands (W)</SelectItem>
                        <SelectItem value="H">Tuas (H)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrivalDepartureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival/Departure Date (DD/MM/YYYY)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DD/MM/YYYY" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrivalDepartureTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival/Departure Time (HH:MM:SS)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="HH:MM:SS" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="border rounded-md p-3 bg-muted/50">
                  <p className="text-sm font-medium mb-2">Pre-filled Values</p>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">TV Group:</span>{" "}
                      99-Unclassified
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Clearance Mode:</span>{" "}
                      E-Enterprise
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Clearance Source:</span>{" "}
                      M-Manual Entry
                    </div>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID (NRIC)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter NRIC" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hostname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hostname</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter Hostname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4 sticky bottom-0 bg-background">
                <Button type="submit">Submit</Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}