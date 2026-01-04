import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Clock, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';

// Type definitions for the itinerary JSON structure
interface TimelineItem {
    start: string;
    end: string;
    activity_type: string;
    name: string;
    area_detail?: string;
    url?: string | null;
    verification?: 'verified' | 'needs_verification';
    stay_min?: number;
    tips?: string[];
    check_opening_hours?: boolean;
    reservation_suggested?: boolean;
    move_mode?: string;
}

interface Plan {
    title?: string;
    timeline: TimelineItem[];
    total_minutes?: number;
    estimated_cost_per_person_jpy?: {
        min?: number | null;
        max?: number | null;
    };
}

interface ItineraryData {
    summary?: {
        total_duration_min?: number;
        mobility_policy?: string;
        atmosphere?: string;
    };
    plan_a?: Plan;
    plan_b?: Plan;
    notes?: string[];
}

interface ItineraryViewerProps {
    data: ItineraryData;
}

const activityTypeLabels: Record<string, string> = {
    meet: '集合',
    walk: '散歩',
    attraction: '観光',
    meal: '食事',
    cafe: 'カフェ',
    shopping: 'ショッピング',
    move: '移動',
    other: 'その他',
};

const moveModeLabels: Record<string, string> = {
    walk: '徒歩',
    taxi: 'タクシー',
    train: '電車',
    other: 'その他',
};

function TimelineItemCard({ item }: { item: TimelineItem }) {
    const isVerified = item.verification === 'verified';
    
    return (
        <div className="mb-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                            {item.start} - {item.end}
                        </span>
                        {item.stay_min && (
                            <span className="text-xs px-2 py-1 bg-muted rounded border border-border">
                                {item.stay_min}分
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                    {item.area_detail && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{item.area_detail}</span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    {item.url && (
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    )}
                    {isVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="検証済み" />
                    ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" aria-label="要確認" />
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs px-2 py-1 bg-secondary rounded border border-border">
                    {activityTypeLabels[item.activity_type] || item.activity_type}
                </span>
                {item.move_mode && (
                    <span className="text-xs px-2 py-1 bg-muted rounded border border-border">
                        {moveModeLabels[item.move_mode] || item.move_mode}
                    </span>
                )}
                {item.check_opening_hours && (
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded border border-yellow-500/30">
                        営業時間要確認
                    </span>
                )}
                {item.reservation_suggested && (
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded border border-blue-500/30">
                        予約推奨
                    </span>
                )}
            </div>
            {item.tips && item.tips.length > 0 && (
                <div className="mt-2">
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {item.tips.map((tip, index) => (
                            <li key={index}>{tip}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function PlanView({ plan }: { plan: Plan }) {
    if (!plan || !plan.timeline || plan.timeline.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8">
                このプランのデータはありません
            </div>
        );
    }

    const totalHours = plan.total_minutes ? Math.floor(plan.total_minutes / 60) : null;
    const totalMins = plan.total_minutes ? plan.total_minutes % 60 : null;

    return (
        <div className="space-y-4">
            {plan.title && (
                <div className="mb-4">
                    <h3 className="text-xl font-semibold mb-2">{plan.title}</h3>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        {totalHours !== null && (
                            <div>
                                所要時間: {totalHours}時間{totalMins !== null && totalMins > 0 ? `${totalMins}分` : ''}
                            </div>
                        )}
                        {plan.estimated_cost_per_person_jpy && (
                            <div>
                                予算: 
                                {plan.estimated_cost_per_person_jpy.min !== null && plan.estimated_cost_per_person_jpy.min !== undefined && (
                                    <span> ¥{plan.estimated_cost_per_person_jpy.min.toLocaleString()}</span>
                                )}
                                {plan.estimated_cost_per_person_jpy.min !== null && plan.estimated_cost_per_person_jpy.max !== null && (
                                    <span> - </span>
                                )}
                                {plan.estimated_cost_per_person_jpy.max !== null && plan.estimated_cost_per_person_jpy.max !== undefined && (
                                    <span>¥{plan.estimated_cost_per_person_jpy.max.toLocaleString()}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="space-y-2">
                {plan.timeline.map((item, index) => (
                    <TimelineItemCard key={index} item={item} />
                ))}
            </div>
        </div>
    );
}

export function ItineraryViewer({ data }: ItineraryViewerProps) {
    const hasPlanA = data.plan_a && data.plan_a.timeline && data.plan_a.timeline.length > 0;
    const hasPlanB = data.plan_b && data.plan_b.timeline && data.plan_b.timeline.length > 0;

    return (
        <div className="space-y-6 p-4 bg-card rounded-lg border">
            {data.summary && (
                <div className="p-4 bg-card border border-border rounded-lg">
                    <h2 className="text-xl font-semibold mb-3">概要</h2>
                    <div className="space-y-2">
                        {data.summary.atmosphere && (
                            <p className="text-muted-foreground">{data.summary.atmosphere}</p>
                        )}
                        {data.summary.mobility_policy && (
                            <div className="text-sm">
                                <strong>移動方針:</strong> {data.summary.mobility_policy}
                            </div>
                        )}
                        {data.summary.total_duration_min && (
                            <div className="text-sm">
                                <strong>総所要時間:</strong> {Math.floor(data.summary.total_duration_min / 60)}時間{data.summary.total_duration_min % 60}分
                            </div>
                        )}
                    </div>
                </div>
            )}

            {hasPlanA && hasPlanB ? (
                <Tabs defaultValue="plan-a" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="plan-a">Plan A</TabsTrigger>
                        <TabsTrigger value="plan-b">Plan B</TabsTrigger>
                    </TabsList>
                    <TabsContent value="plan-a" className="mt-4">
                        <PlanView plan={data.plan_a!} />
                    </TabsContent>
                    <TabsContent value="plan-b" className="mt-4">
                        <PlanView plan={data.plan_b!} />
                    </TabsContent>
                </Tabs>
            ) : hasPlanA ? (
                <div>
                    <h3 className="text-xl font-semibold mb-4">Plan A</h3>
                    <PlanView plan={data.plan_a!} />
                </div>
            ) : hasPlanB ? (
                <div>
                    <h3 className="text-xl font-semibold mb-4">Plan B</h3>
                    <PlanView plan={data.plan_b!} />
                </div>
            ) : null}

            {data.notes && data.notes.length > 0 && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        <h3 className="font-semibold mb-2">注意事項</h3>
                        <ul className="list-disc list-inside space-y-2 text-sm">
                            {data.notes.map((note, index) => (
                                <li key={index}>{note}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

